const mongoose = require('mongoose');

const memberAttendanceSchema = new mongoose.Schema({
  branch: { type: String },
  checkOutVerificationReference: String,
  checkInWorkstation: String,
  checkOutWorkstation: String,
  checkInReceptionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkOutReceptionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staleSessionReviewedByPolicy: Boolean,
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
  sessionName: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    default: 'morning',
  },
  duration: {
    type: Number,
  },
  punches: [
    {
      punchTime: {
        type: Date,
        required: true,
      },
      punchType: {
        type: String,
        enum: ['checkin', 'punch', 'checkout', 'manual'],
        default: 'punch',
      },
      deviceId: String,
      verificationReference: String,
      workstation: String,
      receptionist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
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

memberAttendanceSchema.index({ member: 1, checkInTime: -1 });
memberAttendanceSchema.index({ sessionOpen: 1, checkInTime: 1 });
memberAttendanceSchema.index({ updatedAt: -1 });
memberAttendanceSchema.index({ member: 1, attendanceDate: 1, sessionName: 1 });

memberAttendanceSchema.pre('save', function () {
  this.updatedAt = Date.now();
  
  // Calculate duration if check-out time is set
  this.sessionOpen = !this.checkOutTime;
  if (this.checkOutTime && this.checkInTime) {
    this.duration = Math.max(0, Math.round((this.checkOutTime - this.checkInTime) / 60000));
  } else {
    this.duration = 0;
  }
});

module.exports = mongoose.model('MemberAttendance', memberAttendanceSchema);
