const mongoose = require('mongoose');

const trainerClientAllocationSchema = new mongoose.Schema({
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainerProfile',
    required: true,
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
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
    enum: ['active', 'inactive', 'completed'],
    default: 'active',
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  assignedBy: {
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

trainerClientAllocationSchema.index(
  { member: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
trainerClientAllocationSchema.index({ trainer: 1, status: 1 });

trainerClientAllocationSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('TrainerClientAllocation', trainerClientAllocationSchema);
