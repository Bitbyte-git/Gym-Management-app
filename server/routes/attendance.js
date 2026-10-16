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

// Public routes for kiosk mode
router.post('/checkin', biometricCheckIn);
router.post('/checkout', biometricCheckOut);

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
