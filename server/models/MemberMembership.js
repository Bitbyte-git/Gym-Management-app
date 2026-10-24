const mongoose = require('mongoose');

const memberMembershipSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
    required: true,
  },
  membershipPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: true,
  },
  startDate: {
    type: Date,
    required: [true, 'Please provide start date'],
  },
  endDate: {
    type: Date,
    required: [true, 'Please provide end date'],
  },
  action: {
    type: String,
    enum: ['new_membership', 'renewal', 'upgrade', 'downgrade'],
    default: 'new_membership',
  },
  requestedSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GymTimeSlot',
  },
  requestedTrainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainerProfile',
  },
  frozenAt: { type: Date },
  gatewayOrderId: { type: String },
  checkoutAttempt: { type: String },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'frozen', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial', 'overdue'],
    default: 'paid',
  },
  amountPaid: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  pendingAmount: {
    type: Number,
    default: 0,
  },
  renewalDate: {
    type: Date,
  },
  lastPaymentDate: {
    type: Date,
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

memberMembershipSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'Membership end date must be after the start date');
  }
  if (this.amountPaid < 0 || this.pendingAmount < 0 || this.totalAmount < 0) {
    this.invalidate('totalAmount', 'Membership amounts cannot be negative');
  }
});

memberMembershipSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('MemberMembership', memberMembershipSchema);
