const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getOperatingHours,
  getDayHours,
  createOperatingHours,
  updateOperatingHours,
  deleteOperatingHours,
  isGymOpen,
} = require('../controllers/gymTimingController');

// Specific routes first
router.get('/is-open', isGymOpen);
router.get('/:day', getDayHours);

// Generic routes
router
  .route('/')
  .get(protect, authorize('admin'), getOperatingHours)
  .post(protect, authorize('admin'), auditLogger('upsert', 'gym_operating_hours'), createOperatingHours);

router
  .route('/:id')
  .put(protect, authorize('admin'), auditLogger('update', 'gym_operating_hours'), updateOperatingHours)
  .delete(protect, authorize('admin'), auditLogger('delete', 'gym_operating_hours'), deleteOperatingHours);

module.exports = router;
