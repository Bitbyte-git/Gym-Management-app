const MembershipPlan = require('../models/MembershipPlan');

// @desc    Get all membership plans
// @route   GET /api/membership-plans
// @access  Public
exports.getMembershipPlans = async (req, res, next) => {
  try {
    const plans = await MembershipPlan.find({ status: 'active' }).sort({ price: 1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single membership plan
// @route   GET /api/membership-plans/:id
// @access  Public
exports.getMembershipPlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Membership plan not found',
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new membership plan
// @route   POST /api/membership-plans
// @access  Private (Admin)
exports.createMembershipPlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.create(req.body);

    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update membership plan
// @route   PUT /api/membership-plans/:id
// @access  Private (Admin)
exports.updateMembershipPlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Membership plan not found',
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete membership plan
// @route   DELETE /api/membership-plans/:id
// @access  Private (Admin)
exports.deleteMembershipPlan = async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, { $set: { status: 'inactive' } }, { returnDocument: 'after' });

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Membership plan not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
