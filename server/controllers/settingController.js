const disabledSettings = new Set(['biometric_required', 'biometric_device_enabled', 'auto_renew_membership', 'payment_gateway_enabled']);
const booleanSettings = new Set(['allow_partial_payments', 'allow_manual_attendance', 'enforce_slot_timing']);
const validateSetting = (key, value) => {
  if (disabledSettings.has(key) && value !== false) return 'This integration is deferred or controlled by server configuration';
  if (booleanSettings.has(key) && typeof value !== 'boolean') return 'This setting requires a boolean value';
  return null;
};
const SystemSetting = require('../models/SystemSetting');

// @desc    Get all system settings
// @route   GET /api/settings
// @access  Private (Admin)
exports.getSettings = async (req, res, next) => {
  try {
    const { category } = req.query;
    
    let query = {};
    if (category) {
      query.category = category;
    }

    const settings = await SystemSetting.find(query).sort({ category: 1, key: 1 });

    // Convert to key-value object
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });

    res.status(200).json({
      success: true,
      count: settings.length,
      data: {
        settings,
        settingsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single setting
// @route   GET /api/settings/:key
// @access  Private (Admin)
exports.getSetting = async (req, res, next) => {
  try {
    const setting = await SystemSetting.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update setting
// @route   POST /api/settings
// @access  Private (Admin)
exports.upsertSetting = async (req, res, next) => {
  try {
    const { key, value, category, description, isEditable } = req.body;

    if (typeof key !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(key) ||
        value === undefined || !['general', 'payment', 'biometric', 'notification', 'attendance', 'membership'].includes(category) ||
        (description !== undefined && (typeof description !== 'string' || description.length > 500))) {
      return res.status(400).json({
        success: false,
        error: 'A valid key, value, category, and optional description are required',
      });
    }

    const invalid = validateSetting(key, value);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    let setting = await SystemSetting.findOne({ key });
    if (setting) {
      if (!setting.isEditable) {
        return res.status(403).json({ success: false, error: 'This setting cannot be edited' });
      }
      setting.value = value;
      setting.category = category;
      if (description !== undefined) setting.description = description;
      setting.updatedBy = req.user.id;
    } else {
      setting = new SystemSetting({
        key,
        value,
        category,
        description,
        isEditable: isEditable !== false,
        updatedBy: req.user.id,
      });
    }
    await setting.save();

    res.status(201).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update setting
// @route   PUT /api/settings/:key
// @access  Private (Admin)
exports.updateSetting = async (req, res, next) => {
  try {
    const setting = await SystemSetting.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    if (!setting.isEditable) {
      return res.status(403).json({
        success: false,
        error: 'This setting cannot be edited',
      });
    }

    if (req.body.value === undefined ||
        (req.body.description !== undefined &&
          (typeof req.body.description !== 'string' || req.body.description.length > 500))) {
      return res.status(400).json({ success: false, error: 'A value and optional description are required' });
    }
    const invalid = validateSetting(setting.key, req.body.value);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    setting.value = req.body.value;
    if (req.body.description !== undefined) setting.description = req.body.description;
    setting.updatedBy = req.user.id;
    await setting.save();

    res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete setting
// @route   DELETE /api/settings/:key
// @access  Private (Admin)
exports.deleteSetting = async (req, res, next) => {
  try {
    const setting = await SystemSetting.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }
    if (!setting.isEditable) {
      return res.status(403).json({ success: false, error: 'This setting cannot be deleted' });
    }
    await setting.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initialize default settings
// @route   POST /api/settings/initialize
// @access  Private (Admin)
exports.initializeDefaultSettings = async (req, res, next) => {
  try {
    const defaultSettings = [
      // General settings
      {
        key: 'gym_name',
        value: 'PulseFit Central',
        category: 'general',
        description: 'Gym name displayed throughout the application',
        isEditable: true,
      },
      {
        key: 'gym_address',
        value: 'MG Road, Bengaluru',
        category: 'general',
        description: 'Gym physical address',
        isEditable: true,
      },
      {
        key: 'gym_phone',
        value: '',
        category: 'general',
        description: 'Gym contact phone number',
        isEditable: true,
      },
      {
        key: 'gym_email',
        value: '',
        category: 'general',
        description: 'Gym contact email',
        isEditable: true,
      },
      // Payment settings
      {
        key: 'payment_gateway_enabled',
        value: false,
        category: 'payment',
        description: 'Enable online payment gateway',
        isEditable: true,
      },
      {
        key: 'allow_partial_payments',
        value: false,
        category: 'payment',
        description: 'Allow members to pay in installments',
        isEditable: true,
      },
      {
        key: 'payment_due_grace_period',
        value: 7,
        category: 'payment',
        description: 'Grace period in days before payment overdue',
        isEditable: true,
      },
      // Attendance settings
      {
        key: 'allow_manual_attendance',
        value: true,
        category: 'attendance',
        description: 'Allow manual attendance entry by reception',
        isEditable: true,
      },
      {
        key: 'attendance_correction_window',
        value: 24,
        category: 'attendance',
        description: 'Hours after which attendance cannot be corrected',
        isEditable: true,
      },
      {
        key: 'enforce_slot_timing',
        value: true,
        category: 'attendance',
        description: 'Enforce strict time slot check-in rules',
        isEditable: true,
      },
      // Membership settings
      {
        key: 'auto_renew_membership',
        value: false,
        category: 'membership',
        description: 'Automatically renew membership on expiry',
        isEditable: true,
      },
      {
        key: 'membership_expiry_reminder_days',
        value: 7,
        category: 'membership',
        description: 'Days before expiry to send reminder',
        isEditable: true,
      },
      // Biometric settings
      {
        key: 'biometric_required',
        value: false,
        category: 'biometric',
        description: 'Require biometric enrollment for registration',
        isEditable: true,
      },
      {
        key: 'biometric_device_enabled',
        value: false,
        category: 'biometric',
        description: 'Enable biometric device for check-in',
        isEditable: true,
      },
    ];

    const created = await Promise.all(defaultSettings.map((setting) => SystemSetting.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: { ...setting, updatedBy: req.user.id } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    )));

    res.status(201).json({
      success: true,
      message: 'Default settings initialized or preserved',
      data: created,
    });
  } catch (error) {
    next(error);
  }
};
