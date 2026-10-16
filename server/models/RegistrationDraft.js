const mongoose = require('mongoose');

const registrationDraftSchema = new mongoose.Schema({
  healthConsentAt: { type: Date },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },
  basicDetails: {
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    mobileNumber: { type: String, required: true, match: /^[0-9]{10}$/ },
    address: { type: String, trim: true },
    emergencyContactName: { type: String, required: true, trim: true },
    emergencyContactPhone: { type: String, required: true, match: /^[0-9]{10}$/ },
  },
  healthDetails: {
    height: { type: Number, min: 1 },
    weight: { type: Number, min: 1 },
    fitnessGoal: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'strength', 'general_fitness', 'flexibility'],
    },
    exerciseExperience: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'not_applicable'],
      default: 'not_applicable',
    },
    previousDiseases: { type: String, default: 'none' },
    recentOperations: { type: String, default: 'none' },
    healthNotes: { type: String },
    physicalLimitations: { type: String },
  },
  selection: {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan' },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'GymTimeSlot' },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainerProfile' },
  },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberProfile' },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberMembership' },
  status: {
    type: String,
    enum: ['in_progress', 'pending_payment', 'completed', 'cancelled'],
    default: 'in_progress',
  },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

registrationDraftSchema.index({ lastActivityAt: 1 });

module.exports = mongoose.model('RegistrationDraft', registrationDraftSchema);
