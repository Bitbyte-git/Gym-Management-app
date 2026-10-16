const mongoose = require('mongoose');

const gymTimeSlotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  maxCapacity: {
    type: Number,
    required: true,
    default: 20,
  },
  currentCapacity: {
    type: Number,
    default: 0,
  },
  eligiblePlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
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

gymTimeSlotSchema.pre('validate', function () {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(this.startTime) || !timePattern.test(this.endTime) ||
      this.startTime >= this.endTime) {
    this.invalidate('endTime', 'Time slot must have valid 24-hour times and end after it starts');
  }
  if (!Number.isInteger(this.maxCapacity) || this.maxCapacity < 1) {
    this.invalidate('maxCapacity', 'Capacity must be a positive whole number');
  }
  if (this.currentCapacity < 0 || this.currentCapacity > this.maxCapacity) {
    this.invalidate('currentCapacity', 'Current capacity must be within the configured limit');
  }
});

gymTimeSlotSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('GymTimeSlot', gymTimeSlotSchema);
