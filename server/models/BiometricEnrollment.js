const mongoose = require('mongoose');
const envelope = new mongoose.Schema({
  ciphertext: { type: String, required: true },
  nonce: { type: String, required: true },
  tag: { type: String, required: true },
  keyVersion: { type: String, required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberProfile', required: true, unique: true },
  enrollmentReference: { type: String, required: true, unique: true },
  // Legacy device identifier is preserved; model and serial are separate for new records.
  deviceId: { type: String, required: true },
  enrollmentData: { type: mongoose.Schema.Types.Mixed, select: false },
  encryptedTemplate: { type: envelope, select: false },
  encryptedImage: { type: envelope, select: false },
  fingerPosition: String,
  templateFormat: String,
  imageFormat: String,
  imageWidth: Number,
  imageHeight: Number,
  quality: Number,
  nfiq: Number,
  deviceModel: String,
  deviceSerial: String,
  capturedAt: Date,
  enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  schemaVersion: { type: Number, default: 1 },
  revision: { type: Number, default: 0 },
  enrollmentStatus: { type: String, enum: ['pending', 'enrolled', 'failed'], default: 'pending' },
  enrollmentDate: { type: Date, default: Date.now },
  lastVerificationDate: Date,
  verificationCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
function redact(doc, value) {
  delete value.enrollmentData;
  delete value.encryptedTemplate;
  delete value.encryptedImage;
  return value;
}
schema.set('toJSON', { transform: redact });
schema.set('toObject', { transform: redact });
module.exports = mongoose.model('BiometricEnrollment', schema);
