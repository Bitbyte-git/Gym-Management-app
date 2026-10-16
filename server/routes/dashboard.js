const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAdminDashboard,
  getTrainerDashboard,
  getMemberDashboard,
} = require('../controllers/dashboardController');

router.get('/admin', protect, authorize('admin', 'reception'), getAdminDashboard);
router.get('/trainer', protect, authorize('trainer'), getTrainerDashboard);
router.get('/member', protect, authorize('member'), getMemberDashboard);

module.exports = router;
