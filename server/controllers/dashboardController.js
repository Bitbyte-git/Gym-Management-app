const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberAttendance = require('../models/MemberAttendance');
const Payment = require('../models/Payment');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/admin
// @access  Private (Admin)
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const totalMembers = await MemberProfile.countDocuments();
    const currentMemberIds = await MemberMembership.distinct('member', { status: 'active', paymentStatus: 'paid', startDate: { $lte: new Date() }, endDate: { $gt: new Date() } });
    const activeMembers = await MemberProfile.countDocuments({ _id: { $in: currentMemberIds }, registrationStatus: 'active' });
    const totalTrainers = await TrainerProfile.countDocuments();
    const activeTrainers = await TrainerProfile.countDocuments({ status: 'active' });

    // Today's check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCheckins = await MemberAttendance.countDocuments({
      attendanceDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Currently checked-in members (check-in today but no check-out)
    const currentlyCheckedIn = await MemberAttendance.countDocuments({
      attendanceDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      checkOutTime: null,
    });

    // Monthly revenue (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: currentMonth },
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Memberships expiring soon (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await MemberMembership.countDocuments({
      status: 'active',
      endDate: { $gte: new Date(), $lte: thirtyDaysFromNow },
    });

    // Pending dues
    const pendingDues = await MemberMembership.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pendingAmount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        totalTrainers,
        activeTrainers,
        todayCheckins,
        currentlyCheckedIn,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        expiringSoon,
        pendingDues: pendingDues[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer dashboard stats
// @route   GET /api/dashboard/trainer
// @access  Private (Trainer)
exports.getTrainerDashboard = async (req, res, next) => {
  try {
    const trainerProfile = await TrainerProfile.findOne({ user: req.user.id });
    if (!trainerProfile) {
      return res.status(404).json({
        success: false,
        error: 'Trainer profile not found',
      });
    }

    const activeAllocations = await TrainerClientAllocation.find({
      trainer: trainerProfile._id,
      status: 'active',
    }).select('member');
    const assignedClients = activeAllocations.length;

    // Today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = activeAllocations.length
      ? await MemberAttendance.countDocuments({
          member: { $in: activeAllocations.map(allocation => allocation.member) },
          attendanceDate: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        })
      : 0;

    res.status(200).json({
      success: true,
      data: {
        assignedClients,
        todaySessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member dashboard stats
// @route   GET /api/dashboard/member
// @access  Private (Member)
exports.getMemberDashboard = async (req, res, next) => {
  try {
    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const membership = await MemberMembership.findOne({
      member: memberProfile._id,
      status: 'active',
      paymentStatus: 'paid',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).populate('membershipPlan');

    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await MemberAttendance.findOne({
      member: memberProfile._id,
      attendanceDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Calculate remaining days
    let remainingDays = 0;
    if (membership && membership.endDate) {
      const endDate = new Date(membership.endDate);
      const now = new Date();
      remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    }

    res.status(200).json({
      success: true,
      data: {
        member: memberProfile,
        membership,
        todayAttendance,
        remainingDays,
      },
    });
  } catch (error) {
    next(error);
  }
};
