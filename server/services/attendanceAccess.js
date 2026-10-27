const MemberMembership = require('../models/MemberMembership');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymOperatingHours = require('../models/GymOperatingHours');
const SystemSetting = require('../models/SystemSetting');
const { clockAt } = require('../utils/schedule');
const displayTime = value => new Date(`2000-01-01T${value}:00`).toLocaleTimeString('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
});
const displaySlot = slot => `daily, ${displayTime(slot.startTime)} to ${displayTime(slot.endTime)}`;

const getCurrentMembership = async (memberId, now = new Date(), session = null) => MemberMembership.findOne({
  member: memberId,
  status: 'active',
  paymentStatus: 'paid',
  startDate: { $lte: now },
  endDate: { $gte: now },
}).sort({ endDate: -1 }).session(session);

const validateAttendanceAccess = async (member, now = new Date(), session = null) => {
  if (member.registrationStatus !== 'active' || member.membershipStatus !== 'active') {
    const error = new Error('Member account is not active');
    error.statusCode = 403;
    throw error;
  }
  const membership = await getCurrentMembership(member._id, now, session);
  if (!membership) {
    const error = new Error('No current, paid membership found');
    error.statusCode = 403;
    throw error;
  }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const { day: currentDay, time: currentTime } = clockAt(now);
  const operatingHours = await GymOperatingHours.findOne({ dayOfWeek: currentDay }).session(session);
  if (!operatingHours) {
    const error = new Error('Gym operating hours are not configured for today');
    error.statusCode = 503;
    throw error;
  }
  if (!operatingHours.isOpen || currentTime < operatingHours.openTime || currentTime >= operatingHours.closeTime || (operatingHours.sessions?.length && !operatingHours.sessions.some(session => currentTime >= session.startTime && currentTime < session.endTime))) {
    const error = new Error('The gym is currently closed');
    error.statusCode = 403;
    throw error;
  }
  const timingSetting = await SystemSetting.findOne({ key: 'enforce_slot_timing' }).session(session);
  const enforceSlotTiming = timingSetting ? timingSetting.value === true : false;
  let slotAllocation = null;

  // Always attempt to link member's current slot allocation for reporting/analytics if present
  try {
    slotAllocation = await MemberSlotAllocation.findOne({
      member: member._id,
      status: 'active',
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).populate('timeSlot').session(session);
  } catch (err) {
    slotAllocation = null;
  }

  // Only enforce strict time window if explicitly configured to true in settings
  if (enforceSlotTiming && slotAllocation?.timeSlot) {
    const slot = slotAllocation.timeSlot;
    if (slot.status !== 'active' || currentTime < slot.startTime || currentTime >= slot.endTime) {
      const error = new Error(`Check-in blocked. Assigned time: ${displaySlot(slot)}.`);
      error.statusCode = 403;
      throw error;
    }
  }

  return { membership, slotAllocation };
};


module.exports = { validateAttendanceAccess };
