const { clockAt } = require('../utils/schedule');
const GymOperatingHours = require('../models/GymOperatingHours');
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIMING_FIELDS = ['dayOfWeek', 'isOpen', 'openTime', 'closeTime', 'sessions'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const validateOperatingHours = ({ dayOfWeek, isOpen, openTime, closeTime, sessions }) => {
  if (!VALID_DAYS.includes(dayOfWeek)) return 'Invalid day of week';
  if (typeof isOpen !== 'boolean') return 'isOpen must be a boolean';
  if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime) || openTime >= closeTime) {
    return 'Operating hours must have valid 24-hour times and close after opening';
  }
  if (!Array.isArray(sessions)) return 'Sessions must be an array';
  const sortedSessions = [...sessions].sort((a, b) =>
    String(a?.startTime || '').localeCompare(String(b?.startTime || ''))
  );
  for (let index = 0; index < sortedSessions.length; index += 1) {
    const session = sortedSessions[index];
    if (!session || typeof session.name !== 'string' || !session.name.trim() ||
        session.name.length > 100 || !TIME_PATTERN.test(session.startTime) ||
        !TIME_PATTERN.test(session.endTime) || session.startTime >= session.endTime ||
        session.startTime < openTime || session.endTime > closeTime) {
      return 'Each session needs a name and valid times within operating hours';
    }
    if (index > 0 && sortedSessions[index - 1].endTime > session.startTime) {
      return 'Operating sessions cannot overlap';
    }
  }
  return null;
};

// @desc    Get all gym operating hours
// @route   GET /api/gym-timings
// @access  Private (Admin)
exports.getOperatingHours = async (req, res, next) => {
  try {
    const hours = await GymOperatingHours.find().sort({ dayOfWeek: 1 });

    res.status(200).json({
      success: true,
      count: hours.length,
      data: hours,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single day's operating hours
// @route   GET /api/gym-timings/:day
// @access  Public
exports.getDayHours = async (req, res, next) => {
  try {
    if (!VALID_DAYS.includes(req.params.day)) {
      return res.status(400).json({ success: false, error: 'Invalid day of week' });
    }
    const hours = await GymOperatingHours.findOne({
      dayOfWeek: req.params.day,
    });

    if (!hours) {
      return res.status(404).json({
        success: false,
        error: 'Operating hours not found for this day',
      });
    }

    res.status(200).json({
      success: true,
      data: hours,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update operating hours for a day
// @route   POST /api/gym-timings
// @access  Private (Admin)
exports.createOperatingHours = async (req, res, next) => {
  try {
    const { dayOfWeek, isOpen, openTime, closeTime, sessions } = req.body;
    const validationError = validateOperatingHours({ dayOfWeek, isOpen, openTime, closeTime, sessions });
    if (validationError) return res.status(400).json({ success: false, error: validationError });

    // Check if already exists
    const existing = await GymOperatingHours.findOne({ dayOfWeek });
    
    if (existing) {
      // Update existing
      existing.isOpen = isOpen;
      existing.openTime = openTime;
      existing.closeTime = closeTime;
      existing.sessions = sessions;
      await existing.save();
      
      return res.status(200).json({
        success: true,
        data: existing,
      });
    }

    // Create new
    const hours = await GymOperatingHours.create({
      dayOfWeek,
      isOpen,
      openTime,
      closeTime,
      sessions,
    });

    res.status(201).json({
      success: true,
      data: hours,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update operating hours
// @route   PUT /api/gym-timings/:id
// @access  Private (Admin)
exports.updateOperatingHours = async (req, res, next) => {
  try {
    if (Object.keys(req.body).some((key) => !TIMING_FIELDS.includes(key))) {
      return res.status(400).json({ success: false, error: 'Request contains unsupported operating-hours fields' });
    }
    const hours = await GymOperatingHours.findById(req.params.id);

    if (!hours) {
      return res.status(404).json({
        success: false,
        error: 'Operating hours not found',
      });
    }
    Object.assign(hours, req.body);
    const validationError = validateOperatingHours(hours);
    if (validationError) return res.status(400).json({ success: false, error: validationError });
    await hours.save();

    res.status(200).json({
      success: true,
      data: hours,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete operating hours
// @route   DELETE /api/gym-timings/:id
// @access  Private (Admin)
exports.deleteOperatingHours = async (req, res, next) => {
  try {
    const hours = await GymOperatingHours.findByIdAndDelete(req.params.id);

    if (!hours) {
      return res.status(404).json({
        success: false,
        error: 'Operating hours not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if gym is currently open
// @route   GET /api/gym-timings/is-open
// @access  Public
exports.isGymOpen = async (req, res, next) => {
  try {
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const { day: currentDay, time: currentTime } = clockAt(now);

    const hours = await GymOperatingHours.findOne({ dayOfWeek: currentDay });

    if (!hours || !hours.isOpen) {
      return res.status(200).json({
        success: true,
        data: {
          isOpen: false,
          day: currentDay,
          currentTime,
          message: 'Gym is closed today',
        },
      });
    }

    // Check if current time is within operating hours
    const isOpen = currentTime >= hours.openTime && currentTime < hours.closeTime && (!hours.sessions?.length || hours.sessions.some(session => currentTime >= session.startTime && currentTime < session.endTime));

    res.status(200).json({
      success: true,
      data: {
        isOpen,
        day: currentDay,
        currentTime,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        sessions: hours.sessions,
      },
    });
  } catch (error) {
    next(error);
  }
};
