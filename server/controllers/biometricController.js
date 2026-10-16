const { protect, authorize } = require('../middleware/auth');
const MemberProfile = require('../models/MemberProfile');
const BiometricEnrollment = require('../models/BiometricEnrollment');
const {
  checkRDServiceAvailability,
  initializeCapture,
  processEnrollment,
  verifyFingerprint,
  getMemberByEnrollment,
  deleteEnrollment,
} = require('../services/biometricService');

// @desc    Check RD Service availability
// @route   GET /api/biometrics/status
// @access  Private
exports.checkDeviceStatus = async (req, res, next) => {
  try {
    const isAvailable = await checkRDServiceAvailability();

    res.status(200).json({
      success: true,
      data: {
        deviceAvailable: isAvailable,
        deviceType: 'Mantra MFS110 L1',
        message: isAvailable
          ? 'Mantra biometric service is available.'
          : 'The documented Mantra SDK integration is not configured.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initialize fingerprint capture for enrollment
// @route   POST /api/biometrics/enroll/initialize
// @access  Private (Member)
exports.initializeEnrollment = async (req, res, next) => {
  try {
    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const captureSession = await initializeCapture(memberProfile._id);

    res.status(200).json({
      success: true,
      data: captureSession,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process captured fingerprint for enrollment
// @route   POST /api/biometrics/enroll/process
// @access  Private (Member)
exports.processEnrollment = async (req, res, next) => {
  try {
    const { captureData } = req.body;

    if (!captureData) {
      return res.status(400).json({
        success: false,
        error: 'Capture data is required',
      });
    }

    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const result = await processEnrollment(memberProfile._id, captureData);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify fingerprint for check-in/check-out
// @route   POST /api/biometrics/verify
// @access  Public (for kiosk mode) or Private
exports.verifyFingerprint = async (req, res, next) => {
  try {
    const { captureData } = req.body;

    if (!captureData) {
      return res.status(400).json({
        success: false,
        error: 'Capture data is required',
      });
    }

    const verificationResult = await verifyFingerprint(captureData);

    if (verificationResult.success && verificationResult.enrollmentReference) {
      // Get member from enrollment reference
      const member = await getMemberByEnrollment(verificationResult.enrollmentReference);
      
      res.status(200).json({
        success: true,
        data: {
          verified: true,
          member,
          verificationReference: verificationResult.enrollmentReference,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: verificationResult.message || 'Fingerprint verification failed',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get member's biometric enrollment status
// @route   GET /api/biometrics/enrollment
// @access  Private (Member)
exports.getEnrollmentStatus = async (req, res, next) => {
  try {
    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const enrollment = await BiometricEnrollment.findOne({ member: memberProfile._id });

    res.status(200).json({
      success: true,
      data: {
        isEnrolled: !!enrollment,
        enrollmentStatus: enrollment?.enrollmentStatus || 'not_enrolled',
        enrollmentDate: enrollment?.enrollmentDate,
        lastVerificationDate: enrollment?.lastVerificationDate,
        verificationCount: enrollment?.verificationCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete biometric enrollment
// @route   DELETE /api/biometrics/enrollment
// @access  Private (Member or Admin)
exports.deleteEnrollment = async (req, res, next) => {
  try {
    const memberProfile = await MemberProfile.findOne({ user: req.user.id });
    
    if (!memberProfile) {
      return res.status(404).json({
        success: false,
        error: 'Member profile not found',
      });
    }

    const result = await deleteEnrollment(memberProfile._id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all biometric enrollments
// @route   GET /api/biometrics/enrollments
// @access  Private (Admin)
exports.getAllEnrollments = async (req, res, next) => {
  try {
    const enrollments = await BiometricEnrollment.find()
      .populate('member', 'memberId fullName mobileNumber')
      .sort({ enrollmentDate: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    next(error);
  }
};
