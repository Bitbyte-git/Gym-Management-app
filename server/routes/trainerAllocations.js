const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam, authorizeMemberRecord, authorizeTrainerParam } = require('../middleware/auth');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const auditLogger = require('../middleware/auditLogger');
const {
  getAllocations,
  getAllocation,
  getTrainerClients,
  getMemberTrainer,
  createAllocation,
  reassignTrainer,
  deleteAllocation,
  getAllocationHistory,
} = require('../controllers/trainerAllocationController');

// Specific routes first
router.get('/trainer/:trainerId', protect, authorizeTrainerParam('trainerId'), getTrainerClients);
router.get('/member/:memberId', protect, authorizeMemberParam('memberId'), getMemberTrainer);
router.get('/history/:memberId', protect, authorizeMemberParam('memberId'), getAllocationHistory);

// Generic routes
router
  .route('/')
  .get(protect, authorize('admin'), getAllocations)
  .post(protect, authorize('admin', 'reception'), auditLogger('assign', 'trainer_allocation'), createAllocation);

router
  .route('/:id')
  .get(
    protect,
    authorizeMemberRecord(async (req) => {
      const allocation = await TrainerClientAllocation.findById(req.params.id).select('member');
      return allocation?.member;
    }),
    getAllocation
  )
  .delete(protect, authorize('admin'), auditLogger('remove', 'trainer_allocation'), deleteAllocation);

router.put('/:id/reassign', protect, authorize('admin', 'reception'), auditLogger('reassign', 'trainer_allocation'), reassignTrainer);

module.exports = router;
