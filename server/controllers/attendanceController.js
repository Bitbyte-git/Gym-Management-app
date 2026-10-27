const dateRange = require('../utils/dateRange');
const { clockAt } = require('../utils/schedule');
const MemberAttendance = require('../models/MemberAttendance');
const MemberProfile = require('../models/MemberProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymOperatingHours = require('../models/GymOperatingHours');
const SystemSetting = require('../models/SystemSetting');
const { verifyFingerprint } = require('../services/biometricService');
const { dateKeyAt, zonedMidnight, gymDayBounds } = require('../utils/gymDate');
const { getSessionName, formatDuration, calculateDailySpending } = require('../utils/gymSession');
const config = require('../config/env');

const { validateAttendanceAccess } = require('../services/attendanceAccess');

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

    // Group records by attendance date to calculate daily spending
    const dateMap = new Map();
    for (const rec of attendance) {
      const key = rec.attendanceDate ? new Date(rec.attendanceDate).toISOString().slice(0, 10) : 'unknown';
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key).push(rec);
    }

    const dailySummaries = [];
    let grandTotalMinutes = 0;
    for (const [dateStr, records] of dateMap.entries()) {
      const spending = calculateDailySpending(records);
      grandTotalMinutes += spending.totalMinutes;
      dailySummaries.push({
        date: dateStr,
        spending,
        recordsCount: records.length,
        sessionsAttended: spending.sessionsAttended,
      });
    }

    res.status(200).json({
      success: true,
      count: attendance.length,
      totalSpendingMinutes: grandTotalMinutes,
      totalSpendingHoursFormatted: formatDuration(grandTotalMinutes),
      data: attendance,
      dailySummaries,
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
    const { start: today, end: tomorrow } = gymDayBounds();

    const attendance = await MemberAttendance.find({
      attendanceDate: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .populate('member', 'memberId fullName mobileNumber avatarInitials')
      .sort({ checkInTime: -1 });

    // Get currently checked-in members
    const currentlyCheckedIn = await MemberAttendance.find({
      sessionOpen: true,
    }).populate('member', 'memberId fullName avatarInitials');

    // Group today's records by member to get today's spending for each member
    const memberMap = new Map();
    for (const rec of attendance) {
      const mId = String(rec.member?._id || rec.member || '');
      if (!memberMap.has(mId)) memberMap.set(mId, []);
      memberMap.get(mId).push(rec);
    }

    const dailySpendingByMember = {};
    let totalGymMinutesToday = 0;
    for (const [mId, records] of memberMap.entries()) {
      const spending = calculateDailySpending(records);
      dailySpendingByMember[mId] = spending;
      totalGymMinutesToday += spending.totalMinutes;
    }

    res.status(200).json({
      success: true,
      data: {
        total: attendance.length,
        checkedIn: attendance.length,
        currentlyPresent: currentlyCheckedIn.length,
        totalGymMinutesToday,
        totalGymHoursTodayFormatted: formatDuration(totalGymMinutesToday),
        records: attendance,
        currentlyCheckedIn,
        dailySpendingByMember,
      },
    });
  } catch (error) {
    next(error);
  }
};

// No trusted matcher is installed. Browser match flags, IDs and scores cannot authorize punches.
const unavailableBiometricAttendance = async (req, res, next) => {
  try {
    const result = await verifyFingerprint();
    res.status(503).json({ success: false, code: result.code, error: result.message });
  } catch (error) { next(error); }
};
exports.biometricCheckIn = unavailableBiometricAttendance;
exports.biometricCheckOut = unavailableBiometricAttendance;

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

    const now = new Date();
    const { start: today } = gymDayBounds(now);
    const currentSession = getSessionName(now, config.gym.timezone);

    // Auto-close open session from a previous day
    await MemberAttendance.updateMany({
      member: memberId,
      sessionOpen: true,
      attendanceDate: { $lt: today },
    }, {
      $set: {
        sessionOpen: false,
        notes: 'Auto-closed stale prior day session on manual check-in',
        updatedAt: now,
      },
    });

    const existingSession = await MemberAttendance.findOne({
      member: memberId,
      sessionOpen: true,
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        error: 'Member currently has an active open session. Please check out first.',
      });
    }

    const attendance = await MemberAttendance.create({
      member: memberId,
      attendanceDate: today,
      checkInTime: now,
      sessionOpen: true,
      sessionName: currentSession,
      attendanceStatus: 'present',
      punches: [{
        punchTime: now,
        punchType: 'checkin',
        deviceId: 'MANUAL',
        receptionist: req.user?._id,
      }],
      notes,
      deviceId: 'MANUAL',
      slotAllocation: slotAllocation?._id,
    });

    const todayRecords = await MemberAttendance.find({
      member: memberId,
      attendanceDate: today,
    });
    const dailySpending = calculateDailySpending(todayRecords);

    res.status(201).json({
      success: true,
      data: attendance,
      dailySpending,
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

    const now = new Date();
    const isStale = (now.getTime() - attendance.checkInTime.getTime()) >= (config.biometric.staleHours || 16) * 3600000;

    let checkOutTime;
    let duration;

    if (req.body.checkOutTime) {
      checkOutTime = new Date(req.body.checkOutTime);
      duration = Math.max(0, Math.round((checkOutTime - attendance.checkInTime) / 60000));
    } else if (isStale) {
      const defaultMins = Number(req.body.duration) || 60;
      duration = defaultMins;
      checkOutTime = new Date(attendance.checkInTime.getTime() + defaultMins * 60000);
    } else {
      checkOutTime = now;
      duration = Math.max(0, Math.round((checkOutTime - attendance.checkInTime) / 60000));
    }

    const defaultStaleNote = isStale ? 'Reviewed and closed stale visit (60m default workout)' : null;
    const updatedNotes = [attendance.notes, defaultStaleNote, notes].filter(Boolean).join('\n');
    const punchRecord = {
      punchTime: checkOutTime,
      punchType: 'checkout',
      deviceId: 'MANUAL',
      receptionist: req.user?._id,
    };

    const checkedOutAttendance = await MemberAttendance.findOneAndUpdate({
      _id: attendance._id,
      sessionOpen: true,
    }, {
      $set: {
        checkOutTime,
        sessionOpen: false,
        duration,
        staleSessionReviewedByPolicy: isStale,
        ...(updatedNotes ? { notes: updatedNotes } : {}),
      },
      $push: { punches: punchRecord },
    }, { returnDocument: 'after' });

    if (!checkedOutAttendance) {
      return res.status(409).json({ success: false, error: 'The attendance session was already checked out' });
    }

    const { start: today } = gymDayBounds(checkOutTime);
    const todayRecords = await MemberAttendance.find({
      member: memberId,
      attendanceDate: today,
    });
    const dailySpending = calculateDailySpending(todayRecords);

    res.status(200).json({
      success: true,
      data: checkedOutAttendance,
      dailySpending,
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
      attendance.attendanceDate = zonedMidnight(dateKeyAt(parsedCheckIn));
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
