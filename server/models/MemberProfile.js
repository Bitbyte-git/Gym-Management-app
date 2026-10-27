const mongoose = require('mongoose');

const memberProfileSchema = new mongoose.Schema({
  attendanceVersion: { type: Number, default: 0, select: false },
  lastBiometricPunchAt: { type: Date, select: false },
  healthConsentAt: { type: Date },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  memberId: {
    type: String,
    required: true,
    unique: true,
  },
  // Basic personal details
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true,
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Please provide date of birth'],
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Please provide gender'],
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please provide mobile number'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit mobile number'],
  },
  address: {
    type: String,
  },
  emergencyContactName: {
    type: String,
    required: [true, 'Please provide emergency contact name'],
  },
  emergencyContactPhone: {
    type: String,
    required: [true, 'Please provide emergency contact phone'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number'],
  },
  // Health and fitness details
  height: {
    type: Number,
    required: [true, 'Please provide height in cm'], min: 1, max: 300,
  },
  weight: {
    type: Number,
    required: [true, 'Please provide weight in kg'], min: 1, max: 500,
  },
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'strength', 'general_fitness', 'flexibility'],
    required: [true, 'Please provide fitness goal'],
  },
  exerciseExperience: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'not_applicable'],
    default: 'not_applicable',
  },
  previousDiseases: {
    type: String,
    default: 'none',
  },
  recentOperations: {
    type: String,
    default: 'none',
  },
  healthNotes: {
    type: String,
  },
  physicalLimitations: {
    type: String,
  },
  // Account status
  registrationStatus: {
    type: String,
    enum: ['pending_registration', 'pending_payment', 'pending_biometric', 'active', 'inactive', 'suspended', 'expired'],
    default: 'pending_registration',
  },
  membershipStatus: {
    type: String,
    enum: ['none', 'active', 'expired', 'frozen'],
    default: 'none',
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  // Profile image - using default avatar system
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

// Update updatedAt on save
memberProfileSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

// Generate avatar initials from full name
memberProfileSchema.pre('save', function () {
  if (this.isModified('fullName') || !this.avatarInitials) {
    const names = this.fullName.split(' ');
    this.avatarInitials = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
});

module.exports = mongoose.model('MemberProfile', memberProfileSchema);
