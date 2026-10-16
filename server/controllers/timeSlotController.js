const { validateSlotHours } = require('../utils/schedule');
const GymTimeSlot = require('../models/GymTimeSlot');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const MembershipPlan = require('../models/MembershipPlan');
const MemberMembership = require('../models/MemberMembership');
const mongoose = require('mongoose');

const SLOT_FIELDS = ['name', 'dayOfWeek', 'startTime', 'endTime', 'maxCapacity', 'eligiblePlans', 'status'];
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const validateSlotInput = (data) => {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (data.startTime !== undefined && !timePattern.test(data.startTime)) return 'Start time must use HH:mm format';
  if (data.endTime !== undefined && !timePattern.test(data.endTime)) return 'End time must use HH:mm format';
  if (data.startTime !== undefined && data.endTime !== undefined && data.startTime >= data.endTime) {
    return 'End time must be later than start time';
  }
  if (data.maxCapacity !== undefined && (!Number.isInteger(data.maxCapacity) || data.maxCapacity < 1)) {
    return 'Capacity must be a positive whole number';
  }
  return null;
};

// @desc    Get all time slots
// @route   GET /api/time-slots
// @access  Public
exports.getTimeSlots = async (req, res, next) => {
  try {
    const { dayOfWeek, planId } = req.query;
    
    let query = { status: 'active' };
    
    if (dayOfWeek) {
      if (typeof dayOfWeek !== 'string' || !VALID_DAYS.includes(dayOfWeek)) {
        return res.status(400).json({ success: false, error: 'Invalid day of week' });
      }
      query.dayOfWeek = dayOfWeek;
    }
    
    if (planId) {
      if (!mongoose.isValidObjectId(planId)) {
        return res.status(400).json({ success: false, error: 'Invalid membership plan ID' });
      }
      query.$or = [
        { eligiblePlans: { $size: 0 } },
        { eligiblePlans: planId },
      ];
    }

    const slots = await GymTimeSlot.find(query)
      .populate('eligiblePlans', 'name price')
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single time slot
// @route   GET /api/time-slots/:id
// @access  Public
exports.getTimeSlot = async (req, res, next) => {
  try {
    const slot = await GymTimeSlot.findById(req.params.id)
      .populate('eligiblePlans');

    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found',
      });
    }

    // Get current capacity
    const currentAllocations = await MemberSlotAllocation.countDocuments({
      timeSlot: req.params.id,
      status: 'active',
    });

    const slotData = slot.toObject();
    slotData.currentCapacity = currentAllocations;
    slotData.availableSlots = slot.maxCapacity - currentAllocations;

    res.status(200).json({
      success: true,
      data: slotData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create time slot
// @route   POST /api/time-slots
// @access  Private (Admin)
exports.createTimeSlot = async (req, res, next) => {
  try {
    const { name, dayOfWeek, startTime, endTime, maxCapacity, eligiblePlans } = req.body;
    if (!VALID_DAYS.includes(dayOfWeek)) {
      return res.status(400).json({ success: false, error: 'Invalid day of week' });
    }
    if (eligiblePlans !== undefined && !Array.isArray(eligiblePlans)) {
      return res.status(400).json({ success: false, error: 'Eligible plans must be an array of plan IDs' });
    }
    if (eligiblePlans?.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, error: 'Eligible plans must contain valid plan IDs' });
    }
    if (eligiblePlans?.length) {
      const matchingPlans = await MembershipPlan.countDocuments({ _id: { $in: eligiblePlans } });
      if (matchingPlans !== new Set(eligiblePlans.map(String)).size) {
        return res.status(400).json({ success: false, error: 'One or more eligible plans do not exist' });
      }
    }
    const validationError = validateSlotInput({ startTime, endTime, maxCapacity });
    if (validationError) return res.status(400).json({ success: false, error: validationError });

    // Check for overlapping slots
    const overlapping = await GymTimeSlot.findOne({
      dayOfWeek,
      status: 'active',
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'A time slot already exists during this time',
      });
    }

    await validateSlotHours({ dayOfWeek, startTime, endTime });
    const slot = await GymTimeSlot.create({
      name,
      dayOfWeek,
      startTime,
      endTime,
      maxCapacity: maxCapacity === undefined ? 20 : maxCapacity,
      eligiblePlans: eligiblePlans || [],
    });

    res.status(201).json({
      success: true,
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update time slot
// @route   PUT /api/time-slots/:id
// @access  Private (Admin)
exports.updateTimeSlot = async (req, res, next) => {
  try {
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => SLOT_FIELDS.includes(key)));
    if (Object.keys(req.body).some((key) => !SLOT_FIELDS.includes(key))) {
      return res.status(400).json({ success: false, error: 'Request contains unsupported time slot fields' });
    }
    const validationError = validateSlotInput(changes);
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    if (changes.dayOfWeek !== undefined && !VALID_DAYS.includes(changes.dayOfWeek)) {
      return res.status(400).json({ success: false, error: 'Invalid day of week' });
    }
    if (changes.eligiblePlans !== undefined &&
        (!Array.isArray(changes.eligiblePlans) ||
         changes.eligiblePlans.some((id) => !mongoose.isValidObjectId(id)))) {
      return res.status(400).json({ success: false, error: 'Eligible plans must be an array of valid plan IDs' });
    }
    if (changes.eligiblePlans?.length) {
      const matchingPlans = await MembershipPlan.countDocuments({ _id: { $in: changes.eligiblePlans } });
      if (matchingPlans !== new Set(changes.eligiblePlans.map(String)).size) {
        return res.status(400).json({ success: false, error: 'One or more eligible plans do not exist' });
      }
    }
    const slot = await GymTimeSlot.findById(req.params.id);

    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found',
      });
    }
    const activeAllocations = await MemberSlotAllocation.countDocuments({
      timeSlot: slot._id,
      status: 'active',
    });
    if (changes.status === 'inactive' && activeAllocations > 0) {
      return res.status(409).json({ success: false, error: 'Reassign active member allocations before deactivating this slot' });
    }
    if (activeAllocations > 0 && ['dayOfWeek', 'startTime', 'endTime', 'eligiblePlans'].some(key =>
      changes[key] !== undefined && JSON.stringify(changes[key]) !== JSON.stringify(slot[key]))) {
      return res.status(409).json({ success: false, error: 'Reassign members before changing an allocated slot schedule or eligibility' });
    }
    slot.currentCapacity = activeAllocations;
    Object.assign(slot, changes);
    if (changes.maxCapacity !== undefined && changes.maxCapacity < activeAllocations) {
      return res.status(409).json({ success: false, error: 'Capacity cannot be lower than current active allocations' });
    }
    if (changes.startTime || changes.endTime || changes.dayOfWeek) {
      const overlapping = await GymTimeSlot.findOne({
        _id: { $ne: slot._id },
        dayOfWeek: slot.dayOfWeek,
        status: 'active',
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime },
      });
      if (overlapping) return res.status(409).json({ success: false, error: 'A time slot already exists during this time' });
    }
    if (slot.status === 'active') await validateSlotHours(slot);
    await slot.save();

    res.status(200).json({
      success: true,
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete time slot
// @route   DELETE /api/time-slots/:id
// @access  Private (Admin)
exports.deleteTimeSlot = async (req, res, next) => {
  try {
    const slot = await GymTimeSlot.findById(req.params.id);

    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found',
      });
    }
    const activeAllocations = await MemberSlotAllocation.countDocuments({
      timeSlot: slot._id,
      status: 'active',
    });
    if (activeAllocations > 0) {
      return res.status(409).json({ success: false, error: 'Reassign active member allocations before deactivating this slot' });
    }
    slot.status = 'inactive';
    if (slot.status === 'active') await validateSlotHours(slot);
    await slot.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Allocate time slot to member
// @route   POST /api/time-slots/allocate
// @access  Private (Admin, Reception)
exports.allocateSlot = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { memberId, slotId, membershipId } = req.body;
    let allocation;
    await session.withTransaction(async () => {
      const membership = await MemberMembership.findOne({
        _id: membershipId,
        member: memberId,
        status: 'active',
        paymentStatus: 'paid',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      }).session(session);
      if (!membership) {
        const error = new Error('An active, paid membership is required');
        error.statusCode = 409;
        throw error;
      }
      const slot = await GymTimeSlot.findOneAndUpdate({
        _id: slotId,
        status: 'active',
        $expr: { $lt: ['$currentCapacity', '$maxCapacity'] },
        $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: membership.membershipPlan }],
      }, { $inc: { currentCapacity: 1 } }, { returnDocument: 'after', session });
      if (!slot) {
        const error = new Error('Invalid, ineligible, or full time slot');
        error.statusCode = 409;
        throw error;
      }
      const existingAllocation = await MemberSlotAllocation.findOne({
        member: memberId,
        status: 'active',
      }).session(session);
      if (existingAllocation) {
        const error = new Error('Member already has an active time slot allocation');
        error.statusCode = 409;
        throw error;
      }
      await validateSlotHours(slot, session);
      await require('../services/allocationService').validateAssignedTrainer(memberId, slot, session);
      [allocation] = await MemberSlotAllocation.create([{
        member: memberId,
        timeSlot: slotId,
        membership: membershipId,
        startDate: membership.startDate,
        endDate: membership.endDate,
        allocatedBy: req.user.id,
      }], { session });
    });

    res.status(201).json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// @desc    Change member's time slot
// @route   PUT /api/time-slots/change/:allocationId
// @access  Private (Admin, Reception)
exports.changeSlot = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { newSlotId } = req.body;
    if (!mongoose.isValidObjectId(newSlotId)) {
      return res.status(400).json({ success: false, error: 'A valid new slot is required' });
    }
    let allocation;
    await session.withTransaction(async () => {
      const existingAllocation = await MemberSlotAllocation.findOne({
        _id: req.params.allocationId,
        status: 'active',
      }).session(session);
      if (!existingAllocation) {
        const error = new Error('Active allocation not found');
        error.statusCode = 404;
        throw error;
      }
      if (existingAllocation.timeSlot.equals(newSlotId)) {
        allocation = existingAllocation;
        return;
      }
      const membership = await MemberMembership.findOne({
        _id: existingAllocation.membership,
        status: 'active',
        paymentStatus: 'paid',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      }).session(session);
      if (!membership) {
        const error = new Error('An active, paid membership is required');
        error.statusCode = 409;
        throw error;
      }
      const newSlot = await GymTimeSlot.findOneAndUpdate({
        _id: newSlotId,
        status: 'active',
        $expr: { $lt: ['$currentCapacity', '$maxCapacity'] },
        $or: [{ eligiblePlans: { $size: 0 } }, { eligiblePlans: membership.membershipPlan }],
      }, { $inc: { currentCapacity: 1 } }, { returnDocument: 'after', session });
      if (!newSlot) {
        const error = new Error('New slot is inactive, ineligible, or full');
        error.statusCode = 409;
        throw error;
      }
      existingAllocation.status = 'cancelled';
      existingAllocation.endDate = new Date();
      await existingAllocation.save({ session });
      const oldSlot = await GymTimeSlot.findOneAndUpdate({
        _id: existingAllocation.timeSlot,
        currentCapacity: { $gt: 0 },
      }, { $inc: { currentCapacity: -1 } }, { session });
      if (!oldSlot) {
        const error = new Error('Slot capacity counter is inconsistent; allocation change was not applied');
        error.statusCode = 409;
        throw error;
      }
      await validateSlotHours(newSlot, session);
      await require('../services/allocationService').validateAssignedTrainer(existingAllocation.member, newSlot, session);
      [allocation] = await MemberSlotAllocation.create([{
        member: existingAllocation.member,
        timeSlot: newSlot._id,
        membership: membership._id,
        startDate: new Date(),
        endDate: membership.endDate,
        allocatedBy: req.user.id,
      }], { session });
    });

    res.status(200).json({
      success: true,
      data: allocation,
      message: 'Time slot changed successfully',
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// @desc    Cancel slot allocation
// @route   DELETE /api/time-slots/allocate/:allocationId
// @access  Private (Admin)
exports.cancelAllocation = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let allocation;
    await session.withTransaction(async () => {
      allocation = await MemberSlotAllocation.findOneAndUpdate({
        _id: req.params.allocationId,
        status: 'active',
      }, { $set: { status: 'cancelled', endDate: new Date() } }, {
        returnDocument: 'after',
        session,
      });
      if (!allocation) {
        const error = new Error('Active allocation not found');
        error.statusCode = 404;
        throw error;
      }
      const slot = await GymTimeSlot.findOneAndUpdate({
        _id: allocation.timeSlot,
        currentCapacity: { $gt: 0 },
      }, { $inc: { currentCapacity: -1 } }, { session });
      if (!slot) {
        const error = new Error('Slot capacity counter is inconsistent; allocation cancellation was not applied');
        error.statusCode = 409;
        throw error;
      }
    });

    res.status(200).json({
      success: true,
      data: allocation,
      message: 'Slot allocation cancelled successfully',
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// @desc    Get slot utilization report
// @route   GET /api/time-slots/utilization
// @access  Private (Admin)
exports.getSlotUtilization = async (req, res, next) => {
  try {
    const slots = await GymTimeSlot.find({ status: 'active' })
      .sort({ dayOfWeek: 1, startTime: 1 });

    const utilization = await Promise.all(
      slots.map(async (slot) => {
        const currentAllocations = await MemberSlotAllocation.countDocuments({
          timeSlot: slot._id,
          status: 'active',
        });

        return {
          slotId: slot._id,
          name: slot.name,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxCapacity: slot.maxCapacity,
          currentCapacity: currentAllocations,
          availableSlots: slot.maxCapacity - currentAllocations,
          utilizationPercentage: Math.round((currentAllocations / slot.maxCapacity) * 100),
        };
      })
    );

    res.status(200).json({
      success: true,
      count: utilization.length,
      data: utilization,
    });
  } catch (error) {
    next(error);
  }
};
