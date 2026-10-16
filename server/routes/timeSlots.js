const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getTimeSlots,
  getTimeSlot,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  allocateSlot,
  changeSlot,
  cancelAllocation,
  getSlotUtilization,
} = require('../controllers/timeSlotController');

router.get('/member/:memberId', protect, require('../middleware/auth').authorizeMemberParam('memberId', { allowTrainer: false }), async (req, res, next) => {
  try { res.json({ success: true, data: await require('../models/MemberSlotAllocation').find({ member: req.params.memberId, status: 'active' }).populate('timeSlot') }); } catch (error) { next(error); }
});
router.get('/allocations', protect, authorize('admin', 'reception'), async (req, res, next) => {
  try { res.json({ success: true, data: await require('../models/MemberSlotAllocation').find().populate('member', 'fullName memberId').populate('timeSlot').sort({ createdAt: -1 }) }); } catch (error) { next(error); }
});
// Specific routes first
router.get('/utilization', protect, authorize('admin'), getSlotUtilization);
router.post('/allocate', protect, authorize('admin', 'reception'), auditLogger('allocate', 'time_slot'), allocateSlot);
router.put('/change/:allocationId', protect, authorize('admin', 'reception'), auditLogger('change', 'time_slot'), changeSlot);
router.delete('/allocate/:allocationId', protect, authorize('admin'), auditLogger('cancel_allocation', 'time_slot'), cancelAllocation);

// Generic routes
router
  .route('/')
  .get(getTimeSlots)
  .post(protect, authorize('admin'), auditLogger('create', 'time_slot'), createTimeSlot);

router
  .route('/:id')
  .get(getTimeSlot)
  .put(protect, authorize('admin'), auditLogger('update', 'time_slot'), updateTimeSlot)
  .delete(protect, authorize('admin'), auditLogger('deactivate', 'time_slot'), deleteTimeSlot);

module.exports = router;
