const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MemberProfile = require('../models/MemberProfile');
const TrainerProfile = require('../models/TrainerProfile');
const config = require('../config/env');
const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id, purpose: 'refresh', jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  });
};

const serializeUser = (user, profile) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  name: profile?.fullName || user.email,
  profile,
});

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error: 'Direct account registration is disabled. Use the member registration workflow.',
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || password.length > 72) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    // Check for user
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Your account has been deactivated',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    // Get profile based on role
    let profile = null;
    if (user.role === 'member') {
      profile = await MemberProfile.findOne({ user: user._id });
    } else if (user.role === 'trainer') {
      profile = await TrainerProfile.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: serializeUser(user, profile),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is unavailable',
      });
    }

    let profile = null;
    if (user.role === 'member') {
      profile = await MemberProfile.findOne({ user: user._id });
    } else if (user.role === 'trainer') {
      profile = await TrainerProfile.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        user: serializeUser(user, profile),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token is required',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }
  if (decoded.purpose !== 'refresh' || !decoded.id) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }

  try {
    const user = await User.findById(decoded.id).select('+refreshTokenHash');

    if (!user || !user.isActive || user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    const accessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    const rotated = await User.findOneAndUpdate({
      _id: user._id,
      isActive: true,
      refreshTokenHash: hashToken(refreshToken),
    }, {
      $set: { refreshTokenHash: hashToken(newRefreshToken) },
    }, { returnDocument: 'after' });
    if (!rotated) {
      return res.status(401).json({ success: false, error: 'Refresh token has already been used' });
    }

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $unset: { refreshTokenHash: 1 } });
    await require('../services/biometricAttendanceService').closeOperatorStations(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};
