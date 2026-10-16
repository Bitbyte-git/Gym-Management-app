const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeTrainerParam } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getAvailabilities,
  getTrainerAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTrainerLeave,
  setTrainerOnLeave,
  reactivateTrainer,
} = require('../controllers/trainerAvailabilityController');

router
  .route('/')
  .get(protect, authorize('admin'), getAvailabilities)
  .post(protect, authorize('admin'), createAvailability);

router.get('/trainer/:trainerId', protect, authorizeTrainerParam('trainerId'), getTrainerAvailability);
router.get('/leave/:trainerId', protect, authorize('admin'), getTrainerLeave);
router.post('/leave/:trainerId', protect, authorize('admin'), auditLogger('place_on_leave', 'trainer'), setTrainerOnLeave);
router.post('/reactivate/:trainerId', protect, authorize('admin'), auditLogger('reactivate', 'trainer'), reactivateTrainer);

router
  .route('/:id')
  .put(protect, authorize('admin'), updateAvailability)
  .delete(protect, authorize('admin'), deleteAvailability);

module.exports = router;
