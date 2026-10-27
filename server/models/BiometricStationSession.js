const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contextId: { type: String, required: true, unique: true },
  branch: { type: String, required: true },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true, index: { expires: 0 } },
  revision: { type: Number, default: 0, select: false },
  lastRecordedMember: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberProfile', select: false },
  sameMemberArmed: { type: Boolean, default: true, select: false },
}, { timestamps: true });
schema.index({ operator: 1, active: 1 });
module.exports = mongoose.model('BiometricStationSession', schema);
