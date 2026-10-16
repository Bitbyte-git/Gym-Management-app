const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id).select('_id role isActive');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
      });
    }
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      return next(error);
    }
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

exports.authorizeMemberParam = (paramName, { allowTrainer = true } = {}) => {
  const MemberProfile = require('../models/MemberProfile');
  const TrainerProfile = require('../models/TrainerProfile');
  const TrainerClientAllocation = require('../models/TrainerClientAllocation');

  return async (req, res, next) => {
    try {
      if (['admin', 'reception'].includes(req.user.role)) {
        return next();
      }

      const memberId = req.params[paramName];
      if (req.user.role === 'member') {
        const member = await MemberProfile.findOne({ user: req.user.id }).select('_id');
        if (member && member._id.toString() === memberId) {
          return next();
        }
      }

      if (allowTrainer && req.user.role === 'trainer') {
        const trainer = await TrainerProfile.findOne({ user: req.user.id }).select('_id');
        if (trainer) {
          const allocation = await TrainerClientAllocation.exists({
            trainer: trainer._id,
            member: memberId,
            status: 'active',
          });
          if (allocation) {
            return next();
          }
        }
      }

      return res.status(403).json({
        success: false,
        error: 'You are not authorized to access this member',
      });
    } catch (error) {
      return next(error);
    }
  };
};

exports.authorizeMemberRecord = (resolveMemberId, { allowTrainer = true } = {}) => {
  const MemberProfile = require('../models/MemberProfile');
  const TrainerProfile = require('../models/TrainerProfile');
  const TrainerClientAllocation = require('../models/TrainerClientAllocation');

  return async (req, res, next) => {
    try {
      if (['admin', 'reception'].includes(req.user.role)) {
        return next();
      }

      const memberId = await resolveMemberId(req);
      if (!memberId) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to access this record',
        });
      }

      if (req.user.role === 'member') {
        const member = await MemberProfile.findOne({ user: req.user.id }).select('_id');
        if (member && member._id.toString() === memberId.toString()) {
          return next();
        }
      }

      if (allowTrainer && req.user.role === 'trainer') {
        const trainer = await TrainerProfile.findOne({ user: req.user.id }).select('_id');
        if (trainer && await TrainerClientAllocation.exists({
          trainer: trainer._id,
          member: memberId,
          status: 'active',
        })) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: 'You are not authorized to access this record',
      });
    } catch (error) {
      return next(error);
    }
  };
};

exports.authorizeTrainerParam = (paramName) => {
  const TrainerProfile = require('../models/TrainerProfile');

  return async (req, res, next) => {
    try {
      if (['admin', 'reception'].includes(req.user.role)) {
        return next();
      }
      if (req.user.role === 'trainer') {
        const trainer = await TrainerProfile.findOne({ user: req.user.id }).select('_id');
        if (trainer && trainer._id.toString() === req.params[paramName]) {
          return next();
        }
      }
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to access this trainer',
      });
    } catch (error) {
      return next(error);
    }
  };
};
