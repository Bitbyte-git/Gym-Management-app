const mongoose = require('mongoose');

const trainerAvailabilitySchema = new mongoose.Schema({
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainerProfile',
    required: true,
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  breakStartTime: {
    type: String,
  },
  breakEndTime: {
    type: String,
  },
  maxClients: {
    type: Number,
    default: 10,
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

trainerAvailabilitySchema.pre('validate', function () {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(this.startTime) || !timePattern.test(this.endTime) ||
      this.startTime >= this.endTime) {
    this.invalidate('endTime', 'Availability must have valid 24-hour times and end after it starts');
  }
  if (!Number.isInteger(this.maxClients) || this.maxClients < 1) {
    this.invalidate('maxClients', 'Maximum clients must be a positive whole number');
  }
  const hasBreakStart = Boolean(this.breakStartTime);
  const hasBreakEnd = Boolean(this.breakEndTime);
  if (hasBreakStart !== hasBreakEnd ||
      (hasBreakStart && (!timePattern.test(this.breakStartTime) ||
        !timePattern.test(this.breakEndTime) ||
        this.breakStartTime < this.startTime ||
        this.breakEndTime > this.endTime ||
        this.breakStartTime >= this.breakEndTime))) {
    this.invalidate('breakEndTime', 'Break must have valid times within the availability window');
  }
});

trainerAvailabilitySchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('TrainerAvailability', trainerAvailabilitySchema);
