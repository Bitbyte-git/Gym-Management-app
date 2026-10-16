const { assignTrainer } = require('../services/allocationService');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const TrainerProfile = require('../models/TrainerProfile');
const MemberProfile = require('../models/MemberProfile');
const TrainerAvailability = require('../models/TrainerAvailability');
const MemberMembership = require('../models/MemberMembership');

// @desc    Get all trainer-client allocations
// @route   GET /api/trainer-allocations
// @access  Private (Admin)
exports.getAllocations = async (req, res, next) => {
  try {
    const allocations = await TrainerClientAllocation.find()
      .populate('trainer', 'trainerId fullName specialization')
      .populate('member', 'memberId fullName mobileNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single allocation
// @route   GET /api/trainer-allocations/:id
// @access  Private
exports.getAllocation = async (req, res, next) => {
  try {
    const allocation = await TrainerClientAllocation.findById(req.params.id)
      .populate('trainer')
      .populate('member', 'memberId fullName mobileNumber fitnessGoal exerciseExperience');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'Allocation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer's assigned clients
// @route   GET /api/trainer-allocations/trainer/:trainerId
// @access  Private
exports.getTrainerClients = async (req, res, next) => {
  try {
    const allocations = await TrainerClientAllocation.find({
      trainer: req.params.trainerId,
      status: 'active',
    })
      .populate('member', 'memberId fullName mobileNumber')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member's assigned trainer
// @route   GET /api/trainer-allocations/member/:memberId
// @access  Private
exports.getMemberTrainer = async (req, res, next) => {
  try {
    const allocation = await TrainerClientAllocation.findOne({
      member: req.params.memberId,
      status: 'active',
    })
      .populate('trainer', 'trainerId fullName specialization experience');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'No active trainer assigned',
      });
    }

    res.status(200).json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign trainer to member
// @route   POST /api/trainer-allocations
// @access  Private (Admin, Reception)
exports.createAllocation = async (req, res, next) => {
  const session = await MemberProfile.startSession();
  try {
    let allocation;
    await session.withTransaction(async () => {
      const member = await MemberProfile.findOne({ _id: req.body.memberId, registrationStatus: 'active' }).session(session);
      const valid = member && await MemberMembership.exists({ member: member._id, status: 'active', paymentStatus: 'paid',
        startDate: { $lte: new Date() }, endDate: { $gt: new Date() } }).session(session);
      if (!valid) throw Object.assign(new Error('A current paid member is required'), { statusCode: 409 });
      allocation = await assignTrainer({ ...req.body, session, assignedBy: req.user.id });
    });
    res.status(201).json({ success: true, data: allocation });
  } catch (error) { next(error); } finally { await session.endSession(); }
};
exports.reassignTrainer = async (req, res, next) => {
  const session = await MemberProfile.startSession();
  try {
    let allocation;
    await session.withTransaction(async () => {
      const old = await TrainerClientAllocation.findOne({ _id: req.params.id, status: 'active' }).session(session);
      if (!old) throw Object.assign(new Error('Active trainer assignment not found'), { statusCode: 404 });
      old.status = 'inactive'; old.endDate = new Date(); await old.save({ session });
      allocation = await assignTrainer({ trainerId: req.body.newTrainerId, memberId: old.member,
        notes: req.body.notes, session, assignedBy: req.user.id });
    });
    res.status(201).json({ success: true, data: allocation });
  } catch (error) { next(error); } finally { await session.endSession(); }
};

// @desc    Remove trainer assignment
// @route   DELETE /api/trainer-allocations/:id
// @access  Private (Admin)
exports.deleteAllocation = async (req, res, next) => {
  try {
    const allocation = await TrainerClientAllocation.findById(req.params.id);
    
    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'Allocation not found',
      });
    }

    // Soft delete - mark as inactive
    allocation.endDate = new Date();
    allocation.status = 'inactive';
    await allocation.save();

    res.status(200).json({
      success: true,
      data: allocation,
      message: 'Trainer assignment removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get allocation history
// @route   GET /api/trainer-allocations/history/:memberId
// @access  Private
exports.getAllocationHistory = async (req, res, next) => {
  try {
    const history = await TrainerClientAllocation.find({
      member: req.params.memberId,
    })
      .populate('trainer', 'trainerId fullName specialization')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};
