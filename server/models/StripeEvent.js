const mongoose = require('mongoose');
module.exports = mongoose.model('StripeEvent', new mongoose.Schema({
  sessionId: { type: String, unique: true, required: true },
  eventId: String,
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberMembership' },
  status: { type: String, enum: ['received', 'completed', 'needs_attention'], default: 'received' },
  lastError: String,
}, { timestamps: true }));
