const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
    required: true,
  },
  membership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberMembership',
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please provide amount'],
    min: [0.01, 'Payment amount must be greater than zero'],
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'cash', 'online_gateway'],
    required: [true, 'Please provide payment method'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  gatewayRefundId: String,
  refundRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  refundReason: String,
  refundError: String,
  gatewayTransactionId: {
    type: String,
  },
  paymentGatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
  },
  notes: {
    type: String,
  },
  action: {
    type: String,
    enum: ['new_membership', 'renewal', 'upgrade', 'downgrade', 'pending_dues'],
    required: true,
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    maxlength: 128,
  },
  refunds: [{
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, maxlength: 500 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gatewayRefundId: String,
    processedAt: { type: Date, default: Date.now },
  }],
  processedBy: {
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

paymentSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Payment', paymentSchema);
