const mongoose = require('mongoose');

const gymOperatingHoursSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
    unique: true,
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
  openTime: {
    type: String,
    required: true,
  },
  closeTime: {
    type: String,
    required: true,
  },
  sessions: [{
    name: {
      type: String,
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
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

gymOperatingHoursSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('GymOperatingHours', gymOperatingHoursSchema);
