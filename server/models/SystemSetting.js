const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  category: {
    type: String,
    enum: ['general', 'payment', 'biometric', 'notification', 'attendance', 'membership'],
    required: true,
  },
  description: {
    type: String,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
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

systemSettingSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
