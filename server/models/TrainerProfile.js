const mongoose = require('mongoose');

const trainerProfileSchema = new mongoose.Schema({
  allocationVersion: { type: Number, default: 0 },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  trainerId: {
    type: String,
    required: true,
    unique: true,
  },
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  dateOfBirth: {
    type: Date,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please provide mobile number'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number'],
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    lowercase: true,
    trim: true,
  },
  specialization: {
    type: String,
    required: [true, 'Please provide specialization'],
  },
  experience: {
    type: Number,
    required: [true, 'Please provide experience in years'],
  },
  certifications: [{
    type: String,
  }],
  joiningDate: {
    type: Date,
    default: Date.now,
  },
  workingDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'suspended'],
    default: 'active',
  },
  leaveReason: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  avatarInitials: {
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

trainerProfileSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

trainerProfileSchema.pre('save', function () {
  if (this.isModified('fullName') || !this.avatarInitials) {
    const names = this.fullName.split(' ');
    this.avatarInitials = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
});

module.exports = mongoose.model('TrainerProfile', trainerProfileSchema);
