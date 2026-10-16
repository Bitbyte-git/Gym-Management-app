const mongoose = require('mongoose');
const User = require('../models/User');
const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const MemberMembership = require('../models/MemberMembership');

exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const query = {};
    if (['admin', 'reception', 'trainer', 'member'].includes(req.query.role)) query.role = req.query.role;
    if (req.query.active === 'true') query.isActive = true;
    if (req.query.active === 'false') query.isActive = false;
    if (req.query.search) {
      const search = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.email = { $regex: search, $options: 'i' };
    }
    const [users, total] = await Promise.all([
      User.find(query).select('_id email role isActive lastLogin createdAt')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
};

exports.createStaffUser = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || typeof password !== 'string' || password.length < 12 ||
        !['admin', 'reception'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Provide a valid email, a password of at least 12 characters, and an admin or reception role.',
      });
    }
    const user = await User.create({ email, password, role });
    res.status(201).json({
      success: true,
      data: { id: user._id, email: user.email, role: user.role, isActive: user.isActive },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }
    if (req.params.id === req.user.id && !isActive) {
      return res.status(409).json({ success: false, error: 'You cannot deactivate your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (!isActive) {
      await User.updateOne({ _id: user._id }, {
        $set: { isActive: false },
        $unset: { refreshTokenHash: 1 },
      });
      await MemberProfile.updateOne({ user: user._id, registrationStatus: 'active' }, {
        $set: { registrationStatus: 'suspended' },
      });
      await TrainerProfile.updateOne({ user: user._id, status: 'active' }, {
        $set: { status: 'inactive' },
      });
    } else {
      if (user.role === 'member') {
        const member = await MemberProfile.findOne({ user: user._id });
        const activeMembership = member && await MemberMembership.exists({
          member: member._id,
          status: 'active',
          paymentStatus: 'paid',
          startDate: { $lte: new Date() },
          endDate: { $gt: new Date() },
        });
        if (!activeMembership) {
          return res.status(409).json({ success: false, error: 'A member account can only be reactivated with a current paid membership' });
        }
        await MemberProfile.updateOne({
          _id: member._id,
          registrationStatus: { $in: ['suspended', 'inactive'] },
        }, {
          $set: { registrationStatus: 'active', membershipStatus: 'active' },
        });
      }
      if (user.role === 'trainer') {
        await TrainerProfile.updateOne({ user: user._id, status: 'inactive' }, {
          $set: { status: 'active' },
        });
      }
      await User.updateOne({ _id: user._id }, { $set: { isActive: true } });
    }

    const updated = await User.findById(user._id).select('_id email role isActive lastLogin');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
