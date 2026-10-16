const mongoose = require('mongoose');

const memberSlotAllocationSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
    required: true,
  },
  timeSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GymTimeSlot',
    required: true,
  },
  membership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberMembership',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired'],
    default: 'active',
  },
  allocatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

memberSlotAllocationSchema.index(
  { member: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
memberSlotAllocationSchema.index({ timeSlot: 1, status: 1 });

memberSlotAllocationSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('MemberSlotAllocation', memberSlotAllocationSchema);
