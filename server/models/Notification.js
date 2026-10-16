const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  deduplicationKey: { type: String, unique: true, sparse: true },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'registration_confirmation',
      'membership_activation',
      'payment_receipt',
      'payment_due',
      'membership_expiry',
      'attendance_confirmation',
      'trainer_assignment',
      'trainer_reassignment',
      'slot_confirmation',
      'slot_change',
      'schedule_cancellation',
      'admin_announcement',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedData: {
    type: mongoose.Schema.Types.Mixed,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  },
  sentVia: [{
    type: String,
    enum: ['in_app', 'sms', 'email'],
  }],
  deliveryErrors: [{
    channel: { type: String, enum: ['sms', 'email'], required: true },
    message: { type: String, required: true },
    attemptedAt: { type: Date, default: Date.now },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Notification', notificationSchema);
