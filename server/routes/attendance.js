const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam, authorizeMemberRecord } = require('../middleware/auth');
const MemberAttendance = require('../models/MemberAttendance');
const auditLogger = require('../middleware/auditLogger');
const {
  getAttendance,
  getAttendanceRecord,
  getMemberAttendance,
  getTodayAttendance,
  biometricCheckIn,
  biometricCheckOut,
  manualCheckIn,
  manualCheckOut,
  correctAttendance,
  getAttendanceStats,
} = require('../controllers/attendanceController');

// Biometric kiosk requests require authentication.
router.post('/checkin', protect, authorize('admin', 'reception', 'member'), biometricCheckIn);
router.post('/checkout', protect, authorize('admin', 'reception', 'member'), biometricCheckOut);

// Automatic member identification uses server-issued sessions; no browser identity assertions.
const biometric = require('../controllers/biometricAttendanceController');
router.use('/biometric', protect, authorize('admin', 'reception'), require('../middleware/localBiometricWorkstation'));
router.get('/biometric/capabilities', biometric.capabilities);
router.get('/biometric/overview', biometric.overview);
router.get('/biometric/candidates', biometric.candidates);
router.post('/biometric/stations', biometric.open);
router.post('/biometric/stations/close', biometric.close);
router.post('/biometric/stations/rearm', biometric.rearm);
router.post('/biometric/challenges', biometric.challenge);
router.post('/biometric/identify', biometric.identify);
router.post('/biometric/record', biometric.record);

// Specific routes
router.get('/today', protect, authorize('admin', 'reception'), getTodayAttendance);
router.get('/stats', protect, authorize('admin'), getAttendanceStats);
router.get('/member/:memberId', protect, authorizeMemberParam('memberId'), getMemberAttendance);
router.post('/manual-checkin', protect, authorize('admin', 'reception'), auditLogger('manual_checkin', 'attendance'), manualCheckIn);
router.post('/manual-checkout', protect, authorize('admin', 'reception'), auditLogger('manual_checkout', 'attendance'), manualCheckOut);
router.put('/:id/correct', protect, authorize('admin'), auditLogger('correct', 'attendance'), correctAttendance);

// Generic routes
router
  .route('/')
  .get(protect, authorize('admin', 'reception'), getAttendance);

router
  .route('/:id')
  .get(
    protect,
    authorizeMemberRecord(async (req) => {
      const attendance = await MemberAttendance.findById(req.params.id).select('member');
      return attendance?.member;
    }),
    getAttendanceRecord
  );

module.exports = router;
