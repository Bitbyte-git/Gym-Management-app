const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeTrainerParam } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  deleteTrainer,
} = require('../controllers/trainerController');

router
  .route('/')
  .get(protect, authorize('admin'), getTrainers)
  .post(protect, authorize('admin'), auditLogger('create', 'trainer'), createTrainer);

router
  .route('/:id')
  .get(protect, authorizeTrainerParam('id'), getTrainer)
  .put(protect, authorize('admin'), auditLogger('update', 'trainer'), updateTrainer)
  .delete(protect, authorize('admin'), auditLogger('deactivate', 'trainer'), deleteTrainer);

module.exports = router;
