const dateRange = require('../utils/dateRange');
const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberAttendance = require('../models/MemberAttendance');
const Payment = require('../models/Payment');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const { formatDuration, calculateDailySpending } = require('../utils/gymSession');

// @desc    Get member registration report
// @route   GET /api/reports/registrations
// @access  Private (Admin)
exports.getRegistrationReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        createdAt: dateRange(startDate, endDate),
      };
    }

    const registrations = await MemberProfile.find(dateFilter)
      .populate('user', 'email')
      .sort({ createdAt: -1 });

    const summary = {
      total: registrations.length,
      byStatus: {},
      byGoal: {},
    };

    registrations.forEach(reg => {
      summary.byStatus[reg.registrationStatus] = (summary.byStatus[reg.registrationStatus] || 0) + 1;
      summary.byGoal[reg.fitnessGoal] = (summary.byGoal[reg.fitnessGoal] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        registrations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get membership report
// @route   GET /api/reports/memberships
// @access  Private (Admin)
exports.getMembershipReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        createdAt: dateRange(startDate, endDate),
      };
    }

    const memberships = await MemberMembership.find(dateFilter)
      .populate('member', 'memberId fullName')
      .populate('membershipPlan', 'name price')
      .sort({ createdAt: -1 });

    const summary = {
      total: memberships.length,
      byStatus: {},
      byPaymentStatus: {},
      totalValue: 0,
    };

    memberships.forEach(m => {
      summary.byStatus[m.status] = (summary.byStatus[m.status] || 0) + 1;
      summary.byPaymentStatus[m.paymentStatus] = (summary.byPaymentStatus[m.paymentStatus] || 0) + 1;
      summary.totalValue += m.totalAmount;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        memberships,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance report
// @route   GET /api/reports/attendance
// @access  Private (Admin)
exports.getAttendanceReport = async (req, res, next) => {
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
      .populate('member', 'memberId fullName')
      .sort({ attendanceDate: -1, checkInTime: -1 });

    const summary = {
      total: attendance.length,
      byStatus: {},
      totalDuration: 0,
      averageDuration: 0,
    };

    attendance.forEach(a => {
      summary.byStatus[a.attendanceStatus] = (summary.byStatus[a.attendanceStatus] || 0) + 1;
      summary.totalDuration += a.duration || 0;
    });

    summary.averageDuration = attendance.length > 0 ? Math.round(summary.totalDuration / attendance.length) : 0;

    // Daily breakdown
    const dailyBreakdown = await MemberAttendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$attendanceDate',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        attendance,
        dailyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private (Admin)
exports.getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let matchQuery = { paymentStatus: 'completed' };
    if (startDate || endDate) {
      matchQuery.paymentDate = dateRange(startDate, endDate);
    }

    const payments = await Payment.find(matchQuery)
      .populate('member', 'memberId fullName')
      .sort({ paymentDate: -1 });

    const summary = {
      totalRevenue: 0,
      byPaymentMethod: {},
      byAction: {},
      count: payments.length,
    };

    payments.forEach(p => {
      summary.totalRevenue += p.amount;
      summary.byPaymentMethod[p.paymentMethod] = (summary.byPaymentMethod[p.paymentMethod] || 0) + p.amount;
      summary.byAction[p.action] = (summary.byAction[p.action] || 0) + 1;
    });

    // Monthly breakdown
    const monthlyBreakdown = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        payments,
        monthlyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer performance report
// @route   GET /api/reports/trainer-performance
// @access  Private (Admin)
exports.getTrainerPerformanceReport = async (req, res, next) => {
  try {
    const { trainerId } = req.query;
    
    let trainerFilter = {};
    if (trainerId) {
      trainerFilter = { _id: trainerId };
    }

    const trainers = await TrainerProfile.find(trainerFilter);

    const performance = await Promise.all(
      trainers.map(async (trainer) => {
        const activeClients = await TrainerClientAllocation.countDocuments({
          trainer: trainer._id,
          status: 'active',
        });

        const totalClients = await TrainerClientAllocation.countDocuments({
          trainer: trainer._id,
        });

        return {
          trainerId: trainer._id,
          trainerName: trainer.fullName,
          specialization: trainer.specialization,
          experience: trainer.experience,
          status: trainer.status,
          activeClients,
          totalClients,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: performance.length,
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer-client allocation report
// @route   GET /api/reports/trainer-allocations
// @access  Private (Admin)
exports.getTrainerAllocationReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        createdAt: dateRange(startDate, endDate),
      };
    }

    const allocations = await TrainerClientAllocation.find(dateFilter)
      .populate('trainer', 'trainerId fullName')
      .populate('member', 'memberId fullName')
      .sort({ createdAt: -1 });

    const summary = {
      total: allocations.length,
      byStatus: {},
    };

    allocations.forEach(a => {
      summary.byStatus[a.status] = (summary.byStatus[a.status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        allocations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get slot utilization report
// @route   GET /api/reports/slot-utilization
// @access  Private (Admin)
exports.getSlotUtilizationReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const GymTimeSlot = require('../models/GymTimeSlot');
    const slots = await GymTimeSlot.find({ status: 'active' })
      .sort({ dayOfWeek: 1, startTime: 1 });

    const utilization = await Promise.all(
      slots.map(async (slot) => {
        let query = { timeSlot: slot._id, status: 'active' };
        
        if (startDate || endDate) {
          query.startDate = dateRange(startDate, endDate);
        }

        const currentAllocations = await MemberSlotAllocation.countDocuments(query);

        return {
          slotId: slot._id,
          name: slot.name,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxCapacity: slot.maxCapacity,
          currentAllocations,
          utilizationPercentage: Math.round((currentAllocations / slot.maxCapacity) * 100),
        };
      })
    );

    const summary = {
      totalSlots: slots.length,
      averageUtilization: Math.round(
        utilization.reduce((sum, u) => sum + u.utilizationPercentage, 0) / (utilization.length || 1)
      ),
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        utilization,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member-wise attendance report
// @route   GET /api/reports/member-attendance/:memberId
// @access  Private
exports.getMemberAttendanceReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = { member: req.params.memberId };
    if (startDate || endDate) {
      query.attendanceDate = dateRange(startDate, endDate);
    }

    const attendance = await MemberAttendance.find(query)
      .sort({ attendanceDate: -1, checkInTime: -1 });

    const summary = {
      totalSessions: attendance.length,
      totalDuration: 0,
      totalDurationFormatted: '0m',
      averageDuration: 0,
      averageDurationFormatted: '0m',
      presentDays: 0,
    };

    // Group records by attendance date to calculate daily spending
    const dateMap = new Map();
    for (const a of attendance) {
      summary.totalDuration += a.duration || 0;
      if (a.attendanceStatus === 'present') {
        summary.presentDays++;
      }
      const key = a.attendanceDate ? new Date(a.attendanceDate).toISOString().slice(0, 10) : 'unknown';
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key).push(a);
    }

    summary.totalDurationFormatted = formatDuration(summary.totalDuration);
    summary.averageDuration = attendance.length > 0 ? Math.round(summary.totalDuration / attendance.length) : 0;
    summary.averageDurationFormatted = formatDuration(summary.averageDuration);

    const dailySummaries = [];
    for (const [dateStr, records] of dateMap.entries()) {
      dailySummaries.push({
        date: dateStr,
        spending: calculateDailySpending(records),
        recordsCount: records.length,
      });
    }

    // Get member details
    const member = await MemberProfile.findById(req.params.memberId).select('memberId fullName avatarInitials');

    res.status(200).json({
      success: true,
      data: {
        member,
        summary,
        dailySummaries,
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending dues report
// @route   GET /api/reports/pending-dues
// @access  Private (Admin, Reception)
exports.getPendingDuesReport = async (req, res, next) => {
  try {
    const pendingMemberships = await MemberMembership.find({
      paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
      status: { $ne: 'cancelled' },
    })
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membershipPlan', 'name price')
      .sort({ endDate: 1 });

    const summary = {
      totalPending: pendingMemberships.length,
      totalAmount: pendingMemberships.reduce((sum, m) => sum + m.pendingAmount, 0),
      byStatus: {},
    };

    pendingMemberships.forEach(m => {
      summary.byStatus[m.paymentStatus] = (summary.byStatus[m.paymentStatus] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        pendingMemberships,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get membership expiry report
// @route   GET /api/reports/expiring-memberships
// @access  Private (Admin)
exports.getExpiringMembershipsReport = async (req, res, next) => {
  try {
    const { days } = req.query;
    const daysThreshold = parseInt(days) || 30;
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const expiring = await MemberMembership.find({
      status: 'active',
      endDate: { $gte: new Date(), $lte: thresholdDate },
    })
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membershipPlan', 'name')
      .sort({ endDate: 1 });

    const summary = {
      total: expiring.length,
      byDays: {},
    };

    expiring.forEach(m => {
      const daysRemaining = Math.ceil((m.endDate - new Date()) / (1000 * 60 * 60 * 24));
      const key = daysRemaining <= 7 ? '7 days' : daysRemaining <= 15 ? '15 days' : '30 days';
      summary.byDays[key] = (summary.byDays[key] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        expiring,
      },
    });
  } catch (error) {
    next(error);
  }
};
