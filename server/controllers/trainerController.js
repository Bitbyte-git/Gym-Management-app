const TrainerProfile = require('../models/TrainerProfile');
const User = require('../models/User');
const Sequence = require('../models/Sequence');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');

// @desc    Get all trainers
// @route   GET /api/trainers
// @access  Private (Admin)
exports.getTrainers = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      const search = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { trainerId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const [trainers, total] = await Promise.all([TrainerProfile.find(query)
      .populate('user', 'email role isActive')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TrainerProfile.countDocuments(query)]);

    res.status(200).json({
      success: true,
      count: total,
      data: { trainers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single trainer
// @route   GET /api/trainers/:id
// @access  Private
exports.getTrainer = async (req, res, next) => {
  try {
    const trainer = await TrainerProfile.findById(req.params.id)
      .populate('user', 'email role isActive');

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }

    if (req.user.role === 'trainer' && trainer.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You are not authorized to access this trainer' });
    }

    res.status(200).json({
      success: true,
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new trainer
// @route   POST /api/trainers
// @access  Private (Admin)
exports.createTrainer = async (req, res, next) => {
  let session;
  try {
    const {
      email,
      password,
      fullName,
      gender,
      dateOfBirth,
      mobileNumber,
      specialization,
      experience,
      certifications,
      joiningDate,
      workingDays,
      convenientTimings,
    } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'A valid email and password of at least 8 characters are required' });
    }
    if (!['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({ success: false, error: 'Select a valid gender' });
    }
    if (!Array.isArray(convenientTimings) || !convenientTimings.length || convenientTimings.some(value => !['morning', 'afternoon', 'evening'].includes(value))) {
      return res.status(400).json({ success: false, error: 'Select at least one valid convenient timing' });
    }
    session = await User.startSession();
    let trainer;
    await session.withTransaction(async () => {
      const sequence = await Sequence.findOneAndUpdate(
        { _id: 'trainer' },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
      );
      const [user] = await User.create([{
        email,
        password,
        role: 'trainer',
      }], { session });
      [trainer] = await TrainerProfile.create([{
        user: user._id,
        trainerId: `TRN${String(sequence.value).padStart(4, '0')}`,
        fullName,
        gender,
        dateOfBirth,
        mobileNumber,
        email,
        specialization,
        experience,
        certifications,
        joiningDate,
        workingDays,
        convenientTimings,
      }], { session });
    });

    res.status(201).json({
      success: true,
      data: trainer,
    });
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
};

// @desc    Update trainer
// @route   PUT /api/trainers/:id
// @access  Private (Admin)
exports.updateTrainer = async (req, res, next) => {
  try {
    if (req.body.gender !== undefined && !['male', 'female', 'other'].includes(req.body.gender)) {
      return res.status(400).json({ success: false, error: 'Select a valid gender' });
    }
    if (req.body.convenientTimings !== undefined &&
        (!Array.isArray(req.body.convenientTimings) || !req.body.convenientTimings.length ||
         req.body.convenientTimings.some(value => !['morning', 'afternoon', 'evening'].includes(value)))) {
      return res.status(400).json({ success: false, error: 'Select at least one valid convenient timing' });
    }
    const trainer = await TrainerProfile.findById(req.params.id);

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }

    const fields = [
      'fullName', 'gender', 'dateOfBirth', 'mobileNumber', 'specialization',
      'experience', 'certifications', 'joiningDate', 'workingDays', 'convenientTimings', 'status',
    ];
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) trainer[field] = req.body[field];
    }
    await trainer.save();

    res.status(200).json({
      success: true,
      data: trainer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete trainer
// @route   DELETE /api/trainers/:id
// @access  Private (Admin)
exports.deleteTrainer = async (req, res, next) => {
  let session;
  try {
    session = await User.startSession();
    let trainer;
    await session.withTransaction(async () => {
      trainer = await TrainerProfile.findById(req.params.id).session(session);
      if (!trainer) return;
      trainer.status = 'inactive';
      await trainer.save({ session });
      await User.updateOne({ _id: trainer.user }, {
        $set: { isActive: false },
        $unset: { refreshTokenHash: 1 },
      }, { session });
      await TrainerClientAllocation.updateMany({
        trainer: trainer._id,
        status: 'active',
      }, {
        $set: { status: 'inactive', endDate: new Date() },
      }, { session });
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { trainerId: trainer.trainerId, status: trainer.status },
    });
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
};
