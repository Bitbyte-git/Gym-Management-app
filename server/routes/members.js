const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeMemberParam } = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const {
  getMembers,
  getMember,
  createMember,
  getMemberProfile,
  updateMemberProfile,
  updateMember,
  deleteMember,
} = require('../controllers/memberController');

router
  .route('/')
  .get(protect, authorize('admin', 'reception'), getMembers)
  .post(protect, authorize('admin', 'reception'), createMember);

router.get('/profile', protect, authorize('member'), getMemberProfile);
router.put('/profile', protect, authorize('member'), auditLogger('update_profile', 'member'), updateMemberProfile);

router
  .route('/:id')
  .get(protect, authorizeMemberParam('id'), getMember)
  .put(protect, authorizeMemberParam('id', { allowTrainer: false }), auditLogger('update', 'member'), updateMember)
  .delete(protect, authorize('admin'), auditLogger('deactivate', 'member'), deleteMember);

module.exports = router;
