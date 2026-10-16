const TrainerAvailability = require('../models/TrainerAvailability');
const TrainerProfile = require('../models/TrainerProfile');

const AVAILABILITY_FIELDS = [
  'dayOfWeek',
  'startTime',
  'endTime',
  'breakStartTime',
  'breakEndTime',
  'maxClients',
  'isActive',
];

// @desc    Get all trainer availabilities
// @route   GET /api/trainer-availabilities
// @access  Private (Admin)
exports.getAvailabilities = async (req, res, next) => {
  try {
    const availabilities = await TrainerAvailability.find()
      .populate('trainer', 'trainerId fullName')
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: availabilities.length,
      data: availabilities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer's availability
// @route   GET /api/trainer-availabilities/trainer/:trainerId
// @access  Private
exports.getTrainerAvailability = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId).select('status');
    if (!trainer) {
      return res.status(404).json({ success: false, error: 'Trainer not found' });
    }
    if (trainer.status !== 'active') {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    const availabilities = await TrainerAvailability.find({
      trainer: req.params.trainerId,
      isActive: true,
    })
      .sort({ dayOfWeek: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      count: availabilities.length,
      data: availabilities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create trainer availability
// @route   POST /api/trainer-availabilities
// @access  Private (Admin)
exports.createAvailability = async (req, res, next) => {
  try {
    const { trainerId, dayOfWeek, startTime, endTime, breakStartTime, breakEndTime, maxClients } = req.body;

    // Validate trainer
    const trainer = await TrainerProfile.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'active') {
      return res.status(409).json({ success: false, error: 'Availability cannot be added to an inactive or absent trainer' });
    }

    // Check for overlapping availability
    const overlapping = await TrainerAvailability.findOne({
      trainer: trainerId,
      dayOfWeek,
      isActive: true,
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
        error: 'Trainer already has availability during this time slot',
      });
    }

    const availability = await TrainerAvailability.create({
      trainer: trainerId,
      dayOfWeek,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      maxClients: maxClients === undefined ? 10 : maxClients,
    });

    res.status(201).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update trainer availability
// @route   PUT /api/trainer-availabilities/:id
// @access  Private (Admin)
exports.updateAvailability = async (req, res, next) => {
  try {
    const availability = await TrainerAvailability.findById(req.params.id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
      });
    }
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => AVAILABILITY_FIELDS.includes(key)));
    Object.assign(availability, changes);
    if (changes.trainer || changes.dayOfWeek || changes.startTime || changes.endTime || changes.isActive !== false) {
      const overlapping = await TrainerAvailability.findOne({
        _id: { $ne: availability._id },
        trainer: availability.trainer,
        dayOfWeek: availability.dayOfWeek,
        isActive: true,
        startTime: { $lt: availability.endTime },
        endTime: { $gt: availability.startTime },
      });
      if (overlapping && availability.isActive) {
        return res.status(409).json({ success: false, error: 'Trainer already has overlapping active availability' });
      }
    }
    const allocations = await require('../models/TrainerClientAllocation').find({ trainer: availability.trainer, status: 'active' }).select('member');
    if (allocations.length) {
      const otherSchedules = await TrainerAvailability.find({ trainer: availability.trainer, _id: { $ne: availability._id }, isActive: true });
      const schedules = [...otherSchedules, ...(availability.isActive ? [availability] : [])];
      const bookings = await require('../models/MemberSlotAllocation').find({ member: { $in: allocations.map(item => item.member) }, status: 'active' }).populate('timeSlot');
      if (bookings.some(booking => !schedules.some(schedule => require('../utils/schedule').coversSlot(schedule, booking.timeSlot) && schedule.maxClients >= allocations.length))) {
        return res.status(409).json({ success: false, error: 'Reassign clients before changing a schedule or reducing capacity below current bookings' });
      }
    }
    await availability.save();

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete trainer availability
// @route   DELETE /api/trainer-availabilities/:id
// @access  Private (Admin)
exports.deleteAvailability = async (req, res, next) => {
  try {
    const availability = await TrainerAvailability.findById(req.params.id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
      });
    }
    availability.isActive = false;
    const allocations = await require('../models/TrainerClientAllocation').find({ trainer: availability.trainer, status: 'active' }).select('member');
    if (allocations.length) {
      const otherSchedules = await TrainerAvailability.find({ trainer: availability.trainer, _id: { $ne: availability._id }, isActive: true });
      const schedules = [...otherSchedules, ...(availability.isActive ? [availability] : [])];
      const bookings = await require('../models/MemberSlotAllocation').find({ member: { $in: allocations.map(item => item.member) }, status: 'active' }).populate('timeSlot');
      if (bookings.some(booking => !schedules.some(schedule => require('../utils/schedule').coversSlot(schedule, booking.timeSlot) && schedule.maxClients >= allocations.length))) {
        return res.status(409).json({ success: false, error: 'Reassign clients before changing a schedule or reducing capacity below current bookings' });
      }
    }
    await availability.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trainer leave information
// @route   GET /api/trainer-availabilities/leave/:trainerId
// @access  Private (Admin)
exports.getTrainerLeave = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }

    const isOnLeave = trainer.status === 'on_leave';

    res.status(200).json({
      success: true,
      data: {
        trainerId: trainer._id,
        trainerName: trainer.fullName,
        status: trainer.status,
        isOnLeave,
        leaveReason: trainer.leaveReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set trainer on leave
// @route   POST /api/trainer-availabilities/leave/:trainerId
// @access  Private (Admin)
exports.setTrainerOnLeave = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (req.body.startDate !== undefined || req.body.endDate !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled leave ranges are not supported; this action records an open-ended leave until manually reactivated.',
      });
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({ success: false, error: 'Leave reason must be 500 characters or fewer' });
    }

    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'active') {
      return res.status(409).json({ success: false, error: 'Only an active trainer can be placed on leave' });
    }

    trainer.status = 'on_leave';
    trainer.leaveReason = reason?.trim() || undefined;
    await trainer.save();

    res.status(200).json({
      success: true,
      data: trainer,
      message: 'Trainer marked as on leave',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reactivate trainer from leave
// @route   POST /api/trainer-availabilities/reactivate/:trainerId
// @access  Private (Admin)
exports.reactivateTrainer = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.trainerId);
    
    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }
    if (trainer.status !== 'on_leave') {
      return res.status(409).json({ success: false, error: 'Trainer is not currently on leave' });
    }

    trainer.status = 'active';
    trainer.leaveReason = undefined;
    await trainer.save();

    res.status(200).json({
      success: true,
      data: trainer,
      message: 'Trainer reactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};
