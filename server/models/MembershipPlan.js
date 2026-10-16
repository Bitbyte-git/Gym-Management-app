const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide plan name'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
  },
  duration: {
    type: Number,
    required: [true, 'Please provide duration in months'],
    min: 1, max: 120, validate: Number.isInteger,
  },
  price: {
    type: Number,
    required: [true, 'Please provide price'],
    min: 0.01, validate: { validator: value => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, message: 'Price must have at most two decimal places' },
  },
  facilities: [{
    type: String,
  }],
  eligibilityRules: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  discountRules: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

membershipPlanSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
