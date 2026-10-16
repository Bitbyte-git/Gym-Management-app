/**
 * Mantra MFS110 L1 Biometric Service
 * 
 * IMPORTANT: This service requires the official Mantra RD Service to be installed
 * and running on the Windows machine. The RD Service typically runs on port 10000.
 * 
 * No capture, enrollment, or identification capability is reported as available
 * until the documented SDK workflow is implemented.
 */

const BiometricEnrollment = require('../models/BiometricEnrollment');

/**
 * Report availability only after the documented Mantra integration is implemented.
 */
const checkRDServiceAvailability = async () => {
  return false;
};

/**
 * Initialize fingerprint capture for enrollment
 * @param {string} memberId - Member ID
 * @returns {Promise<Object>} Capture session details
 */
const initializeCapture = async (memberId) => {
  void memberId;
  const error = new Error('Mantra capture is unavailable until the official SDK workflow is integrated.');
  error.statusCode = 503;
  throw error;
};

/**
 * Process captured fingerprint for enrollment
 * @param {string} memberId - Member ID
 * @param {Object} captureData - Captured fingerprint data from device
 * @returns {Promise<Object>} Enrollment result
 */
const processEnrollment = async (memberId, captureData) => {
  void memberId;
  void captureData;
  const error = new Error('Biometric enrollment is unavailable until a documented Mantra enrollment workflow is integrated.');
  error.statusCode = 503;
  throw error;
};

/**
 * Verify fingerprint for check-in/check-out
 * @param {Object} captureData - Captured fingerprint data
 * @returns {Promise<Object>} Verification result with member ID
 */
const verifyFingerprint = async (captureData) => {
  void captureData;
  return {
    success: false,
    message: 'Biometric verification is unavailable until the documented Mantra identification workflow is integrated.',
  };
};

/**
 * Get member by enrollment reference
 * @param {string} enrollmentReference - Enrollment reference from device
 * @returns {Promise<Object>} Member profile
 */
const getMemberByEnrollment = async (enrollmentReference) => {
  try {
    const enrollment = await BiometricEnrollment.findOne({
      enrollmentReference,
      enrollmentStatus: 'enrolled',
      isActive: true,
    }).populate('member');

    if (!enrollment) {
      throw new Error('No active enrollment found for this reference');
    }

    // Update verification count
    enrollment.verificationCount += 1;
    enrollment.lastVerificationDate = new Date();
    await enrollment.save();

    return enrollment.member;
  } catch (error) {
    console.error('Error getting member by enrollment:', error);
    throw error;
  }
};

/**
 * Delete biometric enrollment
 * @param {string} memberId - Member ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteEnrollment = async (memberId) => {
  try {
    const enrollment = await BiometricEnrollment.findOneAndDelete({ member: memberId });
    
    if (!enrollment) {
      throw new Error('No enrollment found for this member');
    }

    return {
      success: true,
      message: 'Biometric enrollment deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    throw error;
  }
};

module.exports = {
  checkRDServiceAvailability,
  initializeCapture,
  processEnrollment,
  verifyFingerprint,
  getMemberByEnrollment,
  deleteEnrollment,
};
