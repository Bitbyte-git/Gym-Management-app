const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam, authorizeMemberRecord } = require('../middleware/auth');
const MemberMembership = require('../models/MemberMembership');
const auditLogger = require('../middleware/auditLogger');
const {
  getMemberships,
  getMembership,
  getMemberMembership,
  createMembership,
  renewMembership,
  changeMembership,
  cancelMembership,
  freezeMembership,
  unfreezeMembership,
} = require('../controllers/membershipController');

router
  .route('/')
  .get(protect, authorize('admin', 'reception'), getMemberships)
  .post(protect, authorize('admin', 'reception'), auditLogger('create', 'membership'), createMembership);

router
  .route('/:id')
  .get(
    protect,
    authorizeMemberRecord(async (req) => {
      const membership = await MemberMembership.findById(req.params.id).select('member');
      return membership?.member;
    }, { allowTrainer: false }),
    getMembership
  );

router.patch('/:id/selection', protect, authorize('admin', 'reception'), auditLogger('update_selection', 'membership'), require('../controllers/membershipController').updatePendingSelection);

router.post('/:id/renew', protect, authorize('admin', 'reception'), auditLogger('renew', 'membership'), renewMembership);
router.post('/:id/change', protect, authorize('admin', 'reception'), auditLogger('change', 'membership'), changeMembership);
router.post('/:id/cancel', protect, authorize('admin'), auditLogger('cancel', 'membership'), cancelMembership);
router.post('/:id/freeze', protect, authorize('admin'), auditLogger('freeze', 'membership'), freezeMembership);
router.post('/:id/unfreeze', protect, authorize('admin'), auditLogger('unfreeze', 'membership'), unfreezeMembership);

router.get('/history/:memberId', protect, authorizeMemberParam('memberId', { allowTrainer: false }), async (req, res, next) => {
  try { res.json({ success: true, data: await MemberMembership.find({ member: req.params.memberId }).populate('membershipPlan').sort({ createdAt: -1 }) }); } catch (error) { next(error); }
});
router.get('/member/:memberId', protect, authorizeMemberParam('memberId', { allowTrainer: false }), getMemberMembership);

module.exports = router;
