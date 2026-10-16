const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam } = require('../middleware/auth');
const {
  getRegistrationReport,
  getMembershipReport,
  getAttendanceReport,
  getRevenueReport,
  getTrainerPerformanceReport,
  getTrainerAllocationReport,
  getSlotUtilizationReport,
  getMemberAttendanceReport,
  getPendingDuesReport,
  getExpiringMembershipsReport,
} = require('../controllers/reportController');

router.get('/registrations', protect, authorize('admin'), getRegistrationReport);
router.get('/memberships', protect, authorize('admin'), getMembershipReport);
router.get('/attendance', protect, authorize('admin'), getAttendanceReport);
router.get('/revenue', protect, authorize('admin'), getRevenueReport);
router.get('/trainer-performance', protect, authorize('admin'), getTrainerPerformanceReport);
router.get('/trainer-allocations', protect, authorize('admin'), getTrainerAllocationReport);
router.get('/slot-utilization', protect, authorize('admin'), getSlotUtilizationReport);
router.get('/member-attendance/:memberId', protect, authorizeMemberParam('memberId'), getMemberAttendanceReport);
router.get('/pending-dues', protect, authorize('admin', 'reception'), getPendingDuesReport);
router.get('/expiring-memberships', protect, authorize('admin'), getExpiringMembershipsReport);

module.exports = router;
