const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMembershipPlans,
  getMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
} = require('../controllers/membershipPlanController');

router
  .route('/')
  .get(getMembershipPlans)
  .post(protect, authorize('admin'), createMembershipPlan);

router
  .route('/:id')
  .get(getMembershipPlan)
  .put(protect, authorize('admin'), updateMembershipPlan)
  .delete(protect, authorize('admin'), deleteMembershipPlan);

module.exports = router;
