const mongoose = require('mongoose');

const memberAttendanceSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberProfile',
    required: true,
  },
  attendanceDate: {
    type: Date,
    required: true,
  },
  checkInTime: {
    type: Date,
    required: true,
  },
  checkOutTime: {
    type: Date,
  },
  sessionOpen: {
    type: Boolean,
    default: true,
  },
  duration: {
    type: Number,
  },
  attendanceStatus: {
    type: String,
    enum: ['present', 'absent', 'late', 'early_leave'],
    default: 'present',
  },
  verificationReference: {
    type: String,
  },
  deviceId: {
    type: String,
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  slotAllocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MemberSlotAllocation',
  },
  correctionReason: {
    type: String,
  },
  correctedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  correctionDate: {
    type: Date,
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

memberAttendanceSchema.index(
  { member: 1 },
  { unique: true, partialFilterExpression: { sessionOpen: true } }
);

memberAttendanceSchema.pre('save', function () {
  this.updatedAt = Date.now();
  
  // Calculate duration if check-out time is set
  this.sessionOpen = !this.checkOutTime;
  if (this.checkOutTime && this.checkInTime) {
    this.duration = Math.round((this.checkOutTime - this.checkInTime) / 60000);
  } else {
    this.duration = undefined;
  }
  
});

module.exports = mongoose.model('MemberAttendance', memberAttendanceSchema);
