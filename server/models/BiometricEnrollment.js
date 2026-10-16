const mongoose = require('mongoose');

const biometricEnrollmentSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
    required: true,
    unique: true,
  },
  enrollmentReference: {
    type: String,
    required: true,
    unique: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  enrollmentData: {
    type: mongoose.Schema.Types.Mixed,
  },
  enrollmentStatus: {
    type: String,
    enum: ['pending', 'enrolled', 'failed'],
    default: 'pending',
  },
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
  lastVerificationDate: {
    type: Date,
  },
  verificationCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
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

biometricEnrollmentSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('BiometricEnrollment', biometricEnrollmentSchema);
