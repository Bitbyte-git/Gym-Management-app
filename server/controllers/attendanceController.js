const dateRange = require('../utils/dateRange');
const { clockAt } = require('../utils/schedule');
const MemberAttendance = require('../models/MemberAttendance');
const MemberProfile = require('../models/MemberProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymOperatingHours = require('../models/GymOperatingHours');
const SystemSetting = require('../models/SystemSetting');
const { verifyFingerprint, getMemberByEnrollment } = require('../services/biometricService');

const getCurrentMembership = async (memberId, now = new Date()) => MemberMembership.findOne({
  member: memberId,
  status: 'active',
  paymentStatus: 'paid',
  startDate: { $lte: now },
  endDate: { $gte: now },
}).sort({ endDate: -1 });

const validateAttendanceAccess = async (member, now = new Date()) => {
  if (member.registrationStatus !== 'active' || member.membershipStatus !== 'active') {
    const error = new Error('Member account is not active');
    error.statusCode = 403;
    throw error;
  }
  const membership = await getCurrentMembership(member._id, now);
  if (!membership) {
    const error = new Error('No current, paid membership found');
    error.statusCode = 403;
    throw error;
  }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const { day: currentDay, time: currentTime } = clockAt(now);
  const operatingHours = await GymOperatingHours.findOne({ dayOfWeek: currentDay });
  if (!operatingHours) {
    const error = new Error('Gym operating hours are not configured for today');
    error.statusCode = 503;
    throw error;
  }
  if (!operatingHours.isOpen || currentTime < operatingHours.openTime || currentTime >= operatingHours.closeTime || (operatingHours.sessions?.length && !operatingHours.sessions.some(session => currentTime >= session.startTime && currentTime < session.endTime))) {
    const error = new Error('The gym is currently closed');
    error.statusCode = 403;
    throw error;
  }
  const timingSetting = await SystemSetting.findOne({ key: 'enforce_slot_timing' });
  const enforceSlotTiming = timingSetting?.value !== false;
  let slotAllocation = null;
  if (enforceSlotTiming) {
    slotAllocation = await MemberSlotAllocation.findOne({
      member: member._id,
      membership: membership._id,
      status: 'active',
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).populate('timeSlot');
    if (!slotAllocation) {
      const previousAllocation = await MemberSlotAllocation.findOne({
        member: member._id,
        status: 'active',
      }).populate('timeSlot');
      if (previousAllocation && previousAllocation.endDate && previousAllocation.endDate <= now) {
        previousAllocation.membership = membership._id;
        previousAllocation.startDate = membership.startDate;
        previousAllocation.endDate = membership.endDate;
        await previousAllocation.save();
        slotAllocation = previousAllocation;
      } else if (previousAllocation &&
          previousAllocation.startDate <= now &&
          (!previousAllocation.endDate || previousAllocation.endDate >= now)) {
        const error = new Error('Active time slot allocation does not match the current membership');
        error.statusCode = 409;
        throw error;
      }
    }
    if (!slotAllocation?.timeSlot) throw Object.assign(new Error('A current slot allocation is required for attendance'), { statusCode: 403 });
    if (slotAllocation?.timeSlot) {
      const slot = slotAllocation.timeSlot;
      if (slot.status !== 'active' || slot.dayOfWeek !== currentDay ||
          currentTime < slot.startTime || currentTime >= slot.endTime) {
        const error = new Error('Check-in is outside the active allocated time slot');
        error.statusCode = 403;
        throw error;
      }
    }
  }
  return { membership, slotAllocation };
};

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Private (Admin, Reception)
exports.getAttendance = async (req, res, next) => {
  try {
    const { startDate, endDate, memberId } = req.query;
    
    let query = {};
    
    if (startDate || endDate) {
      query.attendanceDate = dateRange(startDate, endDate);
    }
    
    if (memberId) {
      query.member = memberId;
    }

    const attendance = await MemberAttendance.find(query)
      .populate('member', 'memberId fullName mobileNumber')
      .populate('slotAllocation')
      .sort({ attendanceDate: -1, checkInTime: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single attendance record
// @route   GET /api/attendance/:id
// @access  Private
exports.getAttendanceRecord = async (req, res, next) => {
  try {
    const attendance = await MemberAttendance.findById(req.params.id)
      .populate('member', 'memberId fullName mobileNumber')
      .populate('slotAllocation');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found',
      });
    }

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member's attendance history
// @route   GET /api/attendance/member/:memberId
// @access  Private
exports.getMemberAttendance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { member: req.params.memberId };
    
    if (startDate || endDate) {
      query.attendanceDate = dateRange(startDate, endDate);
    }

    const attendance = await MemberAttendance.find(query)
      .sort({ attendanceDate: -1, checkInTime: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's attendance
// @route   GET /api/attendance/today
// @access  Private (Admin, Reception)
exports.getTodayAttendance = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await MemberAttendance.find({
      attendanceDate: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate('member', 'memberId fullName mobileNumber')
      .sort({ checkInTime: -1 });

    // Get currently checked-in members
    const currentlyCheckedIn = await MemberAttendance.find({
      sessionOpen: true,
    }).populate('member', 'memberId fullName');

    res.status(200).json({
      success: true,
      data: {
        total: attendance.length,
        checkedIn: attendance.length,
        currentlyPresent: currentlyCheckedIn.length,
        records: attendance,
        currentlyCheckedIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Biometric check-in
// @route   POST /api/attendance/checkin
// @access  Public (for kiosk mode)
exports.biometricCheckIn = async (req, res, next) => {
  try {
    const { captureData } = req.body;

    if (!captureData) {
      return res.status(400).json({
        success: false,
        error: 'Capture data is required',
      });
    }

    // Verify fingerprint
    const verificationResult = await verifyFingerprint(captureData);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.message || 'Fingerprint verification failed',
      });
    }

    // Get member from enrollment reference
    const member = await getMemberByEnrollment(verificationResult.enrollmentReference);

    const { membership, slotAllocation } = await validateAttendanceAccess(member);

    // Check for existing open session today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingSession = await MemberAttendance.findOne({
      member: member._id,
      sessionOpen: true,
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        error: 'Already checked in today',
      });
    }

    // Create attendance record
    const attendance = await MemberAttendance.create({
      member: member._id,
      attendanceDate: today,
      checkInTime: new Date(),
      attendanceStatus: 'present',
      verificationReference: verificationResult.enrollmentReference,
      deviceId: process.env.MANTRA_DEVICE_ID,
      slotAllocation: slotAllocation?._id,
    });

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: {
        attendance,
        member: {
          memberId: member.memberId,
          fullName: member.fullName,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Biometric check-out
// @route   POST /api/attendance/checkout
// @access  Public (for kiosk mode)
exports.biometricCheckOut = async (req, res, next) => {
  try {
    const { captureData } = req.body;

    if (!captureData) {
      return res.status(400).json({
        success: false,
        error: 'Capture data is required',
      });
    }

    // Verify fingerprint
    const verificationResult = await verifyFingerprint(captureData);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.message || 'Fingerprint verification failed',
      });
    }

    // Get member from enrollment reference
    const member = await getMemberByEnrollment(verificationResult.enrollmentReference);

    // Find open attendance session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const openAttendance = await MemberAttendance.findOne({
      member: member._id,
      sessionOpen: true,
    });

    if (!openAttendance) {
      return res.status(400).json({
        success: false,
        error: 'No active check-in session found',
      });
    }

    const checkOutTime = new Date();
    const attendance = await MemberAttendance.findOneAndUpdate({
      _id: openAttendance._id,
      checkOutTime: null,
    }, {
      $set: {
        checkOutTime,
        sessionOpen: false,
        duration: Math.round((checkOutTime - openAttendance.checkInTime) / 60000),
      },
    }, { returnDocument: 'after' });
    if (!attendance) {
      return res.status(409).json({ success: false, error: 'The attendance session was already checked out' });
    }

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: {
        attendance,
        duration: attendance.duration,
        member: {
          memberId: member.memberId,
          fullName: member.fullName,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual check-in (for reception)
// @route   POST /api/attendance/manual-checkin
// @access  Private (Admin, Reception)
exports.manualCheckIn = async (req, res, next) => {
  try {
    const { memberId, notes } = req.body;
    const manualSetting = await SystemSetting.findOne({ key: 'allow_manual_attendance' });
    if (manualSetting?.value === false) {
      return res.status(403).json({ success: false, error: 'Manual attendance is disabled by gym settings' });
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
      return res.status(400).json({ success: false, error: 'Attendance notes must be 500 characters or fewer' });
    }

    const member = await MemberProfile.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }
    const { slotAllocation } = await validateAttendanceAccess(member);

    // Check for existing open session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingSession = await MemberAttendance.findOne({
      member: memberId,
      sessionOpen: true,
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        error: 'Already checked in today',
      });
    }

    const attendance = await MemberAttendance.create({
      member: memberId,
      attendanceDate: today,
      checkInTime: new Date(),
      attendanceStatus: 'present',
      notes,
      deviceId: 'MANUAL',
      slotAllocation: slotAllocation?._id,
    });

    res.status(201).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual check-out (for reception)
// @route   POST /api/attendance/manual-checkout
// @access  Private (Admin, Reception)
exports.manualCheckOut = async (req, res, next) => {
  try {
    const { memberId, notes } = req.body;
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
      return res.status(400).json({ success: false, error: 'Attendance notes must be 500 characters or fewer' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await MemberAttendance.findOne({
      member: memberId,
      sessionOpen: true,
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        error: 'No active check-in session found',
      });
    }

    const checkOutTime = new Date();
    const updatedNotes = [attendance.notes, notes].filter(Boolean).join('\n');
    const checkedOutAttendance = await MemberAttendance.findOneAndUpdate({
      _id: attendance._id,
      checkOutTime: null,
    }, {
      $set: {
        checkOutTime,
        sessionOpen: false,
        duration: Math.round((checkOutTime - attendance.checkInTime) / 60000),
        ...(updatedNotes ? { notes: updatedNotes } : {}),
      },
    }, { returnDocument: 'after' });
    if (!checkedOutAttendance) {
      return res.status(409).json({ success: false, error: 'The attendance session was already checked out' });
    }

    res.status(200).json({
      success: true,
      data: checkedOutAttendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Correct attendance record
// @route   PUT /api/attendance/:id/correct
// @access  Private (Admin)
exports.correctAttendance = async (req, res, next) => {
  try {
    const { correctionReason, checkInTime, checkOutTime } = req.body;
    if (typeof correctionReason !== 'string' || !correctionReason.trim() || correctionReason.length > 500) {
      return res.status(400).json({ success: false, error: 'A correction reason of 1-500 characters is required' });
    }

    const attendance = await MemberAttendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found',
      });
    }

    if (checkInTime !== undefined) {
      const parsedCheckIn = new Date(checkInTime);
      if (Number.isNaN(parsedCheckIn.getTime())) {
        return res.status(400).json({ success: false, error: 'Check-in time must be a valid date' });
      }
      attendance.checkInTime = parsedCheckIn;
      attendance.attendanceDate = new Date(parsedCheckIn);
      attendance.attendanceDate.setHours(0, 0, 0, 0);
    }
    if (checkOutTime !== undefined) {
      if (checkOutTime === null || checkOutTime === '') {
        attendance.checkOutTime = undefined;
      } else {
        const parsedCheckOut = new Date(checkOutTime);
        if (Number.isNaN(parsedCheckOut.getTime())) {
          return res.status(400).json({ success: false, error: 'Check-out time must be a valid date or null' });
        }
        attendance.checkOutTime = parsedCheckOut;
      }
    }
    if (attendance.checkOutTime && attendance.checkOutTime <= attendance.checkInTime) {
      return res.status(400).json({ success: false, error: 'Check-out time must be after check-in time' });
    }
    if (!attendance.checkOutTime) {
      const otherOpenSession = await MemberAttendance.exists({
        member: attendance.member,
        sessionOpen: true,
        _id: { $ne: attendance._id },
      });
      if (otherOpenSession) {
        return res.status(409).json({ success: false, error: 'Member already has another open attendance session for this day' });
      }
    }
    attendance.correctionReason = correctionReason.trim();
    attendance.correctedBy = req.user.id;
    attendance.correctionDate = new Date();
    await attendance.save();

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private (Admin)
exports.getAttendanceStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        attendanceDate: dateRange(startDate, endDate),
      };
    }

    const totalCheckIns = await MemberAttendance.countDocuments(dateFilter);
    
    const totalDuration = await MemberAttendance.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$duration' },
        },
      },
    ]);

    const averageDuration = totalDuration[0] ? Math.round(totalDuration[0].totalMinutes / totalCheckIns) : 0;

    const dailyStats = await MemberAttendance.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$attendanceDate',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCheckIns,
        totalDuration: totalDuration[0]?.totalMinutes || 0,
        averageDuration,
        dailyStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
