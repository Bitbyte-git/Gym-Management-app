const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  eventId: { type: String, required: true, unique: true },
  challenge: { type: String, required: true, select: false },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'BiometricStationSession', required: true },
  branch: { type: String, required: true },
  state: { type: String, enum: ['issued', 'verified', 'consumed', 'rejected', 'cancelled'], default: 'issued' },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberProfile', select: false },
  enrollmentReference: { type: String, select: false },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true, index: { expires: 0 } },
  result: { type: mongoose.Schema.Types.Mixed, select: false },
}, { timestamps: true });
schema.index({ station: 1, state: 1 });
module.exports = mongoose.model('BiometricVerificationSession', schema);
