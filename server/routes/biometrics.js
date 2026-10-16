const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  checkDeviceStatus,
  initializeEnrollment,
  processEnrollment,
  verifyFingerprint,
  getEnrollmentStatus,
  deleteEnrollment,
  getAllEnrollments,
} = require('../controllers/biometricController');

router.get('/status', protect, checkDeviceStatus);
router.post('/enroll/initialize', protect, authorize('member'), initializeEnrollment);
router.post('/enroll/process', protect, authorize('member'), processEnrollment);
router.post('/verify', verifyFingerprint); // Public for kiosk mode
router.get('/enrollment', protect, authorize('member'), getEnrollmentStatus);
router.delete('/enrollment', protect, authorize('member', 'admin'), deleteEnrollment);
router.get('/enrollments', protect, authorize('admin'), getAllEnrollments);

module.exports = router;
