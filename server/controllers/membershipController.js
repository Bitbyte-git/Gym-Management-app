const MemberMembership = require('../models/MemberMembership');
const MembershipPlan = require('../models/MembershipPlan');
const MemberProfile = require('../models/MemberProfile');
const Payment = require('../models/Payment');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const GymTimeSlot = require('../models/GymTimeSlot');
const TrainerProfile = require('../models/TrainerProfile');
const TrainerAvailability = require('../models/TrainerAvailability');
const { addMonthsClamped } = require('../utils/date');

// @desc    Get all memberships
// @route   GET /api/memberships
// @access  Private (Admin, Reception)
exports.getMemberships = async (req, res, next) => {
  try {
    const memberships = await MemberMembership.find()
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membershipPlan', 'name duration price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: memberships.length,
      data: memberships,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single membership
// @route   GET /api/memberships/:id
// @access  Private
exports.getMembership = async (req, res, next) => {
  try {
    const membership = await MemberMembership.findById(req.params.id)
      .populate('member', 'memberId fullName mobileNumber')
      .populate('membershipPlan')
      .populate('slotAllocation');

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'Membership not found',
      });
    }

    res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member's active membership
// @route   GET /api/memberships/member/:memberId
// @access  Private
exports.getMemberMembership = async (req, res, next) => {
  try {
    const membership = await MemberMembership.findOne({
      member: req.params.memberId,
      status: 'active',
      paymentStatus: 'paid',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ endDate: -1 })
      .populate('membershipPlan')
      .populate('slotAllocation');

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'No active membership found',
      });
    }

    res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new membership
// @route   POST /api/memberships
// @access  Private (Admin, Reception)
exports.createMembership = async (req, res, next) => {
  try {
    const { memberId, planId, slotId, trainerId, action } = req.body;
    if (action && action !== 'new_membership') {
      return res.status(400).json({ success: false, error: 'Use the renewal or change endpoint for this membership action' });
    }

    // Validate member
    const member = await MemberProfile.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }
    if (await MemberMembership.exists({ member: memberId, status: 'pending' })) {
      return res.status(409).json({ success: false, error: 'This member already has an unpaid membership request' });
    }

    // Validate plan
    const plan = await MembershipPlan.findOne({ _id: planId, status: 'active' });
    if (!plan || plan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive membership plan',
      });
    }

    // Calculate dates
    if (slotId) {
      const slot = await GymTimeSlot.findOne({
        _id: slotId,
        status: 'active',
        $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: plan._id }],
      });
      if (!slot) return res.status(400).json({ success: false, error: 'Invalid or ineligible time slot' });
    }
    if (trainerId && (!await TrainerProfile.exists({ _id: trainerId, status: 'active' }) ||
        !await TrainerAvailability.exists({ trainer: trainerId, isActive: true }))) {
      return res.status(400).json({ success: false, error: 'Trainer must be active and have active availability' });
    }

    const startDate = new Date();
    const endDate = addMonthsClamped(startDate, plan.duration);

    // Create membership
    const membership = await MemberMembership.create({
      member: memberId,
      membershipPlan: planId,
      startDate,
      endDate,
      status: 'pending',
      paymentStatus: 'pending',
      totalAmount: plan.price,
      pendingAmount: plan.price,
      action: 'new_membership',
    });

    membership.requestedSlot = slotId;
    membership.requestedTrainer = trainerId;
    await membership.save();

    res.status(201).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Renew membership
// @route   POST /api/memberships/:id/renew
// @access  Private (Admin, Reception)
exports.renewMembership = async (req, res, next) => {
  try {
    const existingMembership = await MemberMembership.findById(req.params.id);
    
    if (!existingMembership) {
      return res.status(404).json({
        success: false,
        error: 'Membership not found',
      });
    }
    if (await MemberMembership.exists({ member: existingMembership.member, status: 'pending' })) {
      return res.status(409).json({ success: false, error: 'This member already has an unpaid membership request' });
    }

    const { planId } = req.body;
    const plan = await MembershipPlan.findOne({ _id: planId, status: 'active' });
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }
    if (req.body.slotId) {
      const slot = await GymTimeSlot.findOne({
        _id: req.body.slotId,
        status: 'active',
        $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: plan._id }],
      });
      if (!slot) return res.status(400).json({ success: false, error: 'Invalid or ineligible time slot' });
    }
    if (req.body.trainerId &&
        (!await TrainerProfile.exists({ _id: req.body.trainerId, status: 'active' }) ||
         !await TrainerAvailability.exists({ trainer: req.body.trainerId, isActive: true }))) {
      return res.status(400).json({ success: false, error: 'Trainer must be active and have active availability' });
    }

    // Calculate new dates (start from end date of current membership)
    const startDate = existingMembership.endDate > new Date()
      ? new Date(existingMembership.endDate)
      : new Date();
    const endDate = addMonthsClamped(startDate, plan.duration);

    // Create new membership
    const newMembership = await MemberMembership.create({
      member: existingMembership.member,
      membershipPlan: planId,
      startDate,
      endDate,
      status: 'pending',
      paymentStatus: 'pending',
      totalAmount: plan.price,
      pendingAmount: plan.price,
      action: 'renewal',
      requestedSlot: req.body.slotId,
      requestedTrainer: req.body.trainerId,
    });

    res.status(201).json({
      success: true,
      data: newMembership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upgrade/Downgrade membership
// @route   POST /api/memberships/:id/change
// @access  Private (Admin, Reception)
exports.changeMembership = async (req, res, next) => {
  try {
    const existingMembership = await MemberMembership.findById(req.params.id);
    
    if (!existingMembership) {
      return res.status(404).json({
        success: false,
        error: 'Membership not found',
      });
    }
    if (await MemberMembership.exists({ member: existingMembership.member, status: 'pending' })) {
      return res.status(409).json({ success: false, error: 'This member already has an unpaid membership request' });
    }

    const { planId, action } = req.body;
    if (!['upgrade', 'downgrade'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Choose upgrade or downgrade' });
    }
    if (action === 'downgrade') {
      return res.status(409).json({
        success: false,
        error: 'Downgrades must be scheduled at renewal until a credit and refund policy is configured.',
      });
    }
    const plan = await MembershipPlan.findOne({ _id: planId, status: 'active' });
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // Calculate prorated amount (if upgrading)
    let amount = plan.price;
    if (action === 'upgrade') {
      const oldPlan = await MembershipPlan.findById(existingMembership.membershipPlan);
      if (!oldPlan || existingMembership.status !== 'active' || existingMembership.paymentStatus !== 'paid') {
        return res.status(409).json({ success: false, error: 'An active, paid membership is required for an upgrade' });
      }
      const now = new Date();
      if (existingMembership.startDate > now || existingMembership.endDate <= now ||
          plan.price <= oldPlan.price) {
        return res.status(409).json({ success: false, error: 'The selected plan must be a higher-priced plan than the current active membership' });
      }
      const millisecondsPerDay = 1000 * 60 * 60 * 24;
      const totalDays = Math.max(1, Math.ceil(
        (existingMembership.endDate - existingMembership.startDate) / millisecondsPerDay
      ));
      const remainingDays = Math.min(totalDays, Math.ceil(
        (existingMembership.endDate - now) / millisecondsPerDay
      ));
      amount = Math.round(
        (plan.price - oldPlan.price) * remainingDays / totalDays * 100
      ) / 100;
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'The selected plan does not produce a payable upgrade balance' });
    }
    const changedMembership = await MemberMembership.create({
      member: existingMembership.member,
      membershipPlan: planId,
      startDate: new Date(),
      endDate: existingMembership.endDate,
      status: 'pending',
      paymentStatus: 'pending',
      amountPaid: 0,
      totalAmount: amount,
      pendingAmount: amount,
      action,
      requestedSlot: existingMembership.requestedSlot,
      requestedTrainer: existingMembership.requestedTrainer,
    });

    res.status(200).json({
      success: true,
      data: changedMembership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel membership
// @route   POST /api/memberships/:id/cancel
// @access  Private (Admin)
exports.cancelMembership = async (req, res, next) => {
  const session = await MemberMembership.startSession();
  try {
    let membership;
    await session.withTransaction(async () => {
      membership = await MemberMembership.findById(req.params.id).session(session);
      if (!membership) {
        const error = new Error('Membership not found');
        error.statusCode = 404;
        throw error;
      }
      if (membership.status === 'cancelled') {
        const error = new Error('Membership is already cancelled');
        error.statusCode = 409;
        throw error;
      }
      membership.status = 'cancelled';
      await membership.save({ session });

      const allocation = await MemberSlotAllocation.findOneAndUpdate({
        membership: membership._id,
        status: 'active',
      }, { $set: { status: 'cancelled', endDate: new Date() } }, {
        returnDocument: 'after',
        session,
      });
      if (allocation) {
        const slot = await GymTimeSlot.findOneAndUpdate({
          _id: allocation.timeSlot,
          currentCapacity: { $gt: 0 },
        }, { $inc: { currentCapacity: -1 } }, { session });
        if (!slot) {
          const error = new Error('Slot capacity is inconsistent; membership cancellation was not applied');
          error.statusCode = 409;
          throw error;
        }
      }

      const member = await MemberProfile.findById(membership.member).session(session);
      if (member) {
        const otherActiveMembership = await MemberMembership.exists({
        member: member._id,
        _id: { $ne: membership._id },
        status: 'active',
        paymentStatus: 'paid',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        }).session(session);
        member.membershipStatus = otherActiveMembership ? 'active' : 'none';
        await member.save({ session });
      }
    });

    res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// @desc    Freeze membership
// @route   POST /api/memberships/:id/freeze
// @access  Private (Admin)
const setFrozen = async (req, res, next, freeze) => {
  const session = await MemberMembership.startSession();
  try {
    let membership;
    await session.withTransaction(async () => {
      membership = await MemberMembership.findById(req.params.id).session(session);
      if (!membership) throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
      if (freeze) {
        if (membership.status !== 'active' || membership.paymentStatus !== 'paid' || membership.startDate > new Date() || membership.endDate <= new Date()) {
          throw Object.assign(new Error('Only a current paid membership can be frozen'), { statusCode: 409 });
        }
        membership.status = 'frozen'; membership.frozenAt = new Date();
      } else {
        if (membership.status !== 'frozen' || !membership.frozenAt) throw Object.assign(new Error('A valid frozen membership is required'), { statusCode: 409 });
        membership.endDate = new Date(membership.endDate.getTime() + Date.now() - membership.frozenAt.getTime());
        membership.status = 'active'; membership.frozenAt = undefined;
        await MemberSlotAllocation.updateMany({ membership: membership._id, status: 'active' }, { $set: { endDate: membership.endDate } }, { session });
      }
      await membership.save({ session });
      await MemberProfile.updateOne({ _id: membership.member }, { $set: { membershipStatus: freeze ? 'frozen' : 'active' } }, { session });
    });
    res.json({ success: true, data: membership });
  } catch (error) { next(error); } finally { await session.endSession(); }
};
exports.freezeMembership = (req, res, next) => setFrozen(req, res, next, true);
exports.unfreezeMembership = (req, res, next) => setFrozen(req, res, next, false);

exports.updatePendingSelection = async (req, res, next) => {
  try {
    const slot = await GymTimeSlot.findOne({ _id: req.body.slotId, status: 'active' });
    if (!slot) throw Object.assign(new Error('Select an active slot'), { statusCode: 400 });
    await require('../utils/schedule').validateSlotHours(slot);
    const membership = await MemberMembership.findOneAndUpdate({ _id: req.params.id, status: 'pending' },
      { $set: { requestedSlot: slot._id, requestedTrainer: req.body.trainerId || null } }, { returnDocument: 'after' });
    if (!membership) return res.status(409).json({ success: false, error: 'Only unpaid requests can be updated' });
    res.json({ success: true, data: membership });
  } catch (error) { next(error); }
};
