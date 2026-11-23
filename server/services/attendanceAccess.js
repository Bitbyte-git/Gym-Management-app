const MemberMembership = require('../models/MemberMembership');
const MemberProfile = require('../models/MemberProfile');
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
}).populate('membershipPlan', 'name price duration').sort({ endDate: -1 }).session(session);

const validateAttendanceAccess = async (member, now = new Date(), session = null) => {
  // Query member's latest membership with plan details for rich biometric error reporting
  const latestMembership = await MemberMembership.findOne({ member: member._id })
    .populate('membershipPlan', 'name price duration')
    .sort({ endDate: -1, createdAt: -1 })
    .session(session);

  const memberInfo = {
    id: member._id,
    memberId: member.memberId,
    fullName: member.fullName,
    profilePicture: member.profilePicture || null,
    avatarInitials: member.avatarInitials || member.fullName?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'VF',
  };

  const membershipInfo = latestMembership ? {
    planName: latestMembership.membershipPlan?.name || 'Membership Plan',
    startDate: latestMembership.startDate,
    endDate: latestMembership.endDate,
    status: latestMembership.status,
  } : null;

  // 1. Explicit account suspension check
  if (['suspended', 'inactive'].includes(member.registrationStatus) || member.isActive === false) {
    const error = new Error('Member account is inactive or suspended. Please contact reception.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_INACTIVE';
    error.isExpired = false;
    error.member = memberInfo;
    error.membership = membershipInfo;
    throw error;
  }

  // 2. Check for current valid membership (the source of truth for gym access)
  let membership = await getCurrentMembership(member._id, now, session);
  if (!membership) {
    // Check if there is a paid membership whose dates are valid today
    membership = await MemberMembership.findOne({
      member: member._id,
      paymentStatus: 'paid',
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: { $ne: 'cancelled' },
    }).populate('membershipPlan', 'name price duration').sort({ endDate: -1 }).session(session);

    if (membership) {
      if (membership.status === 'frozen') {
        // Auto-unfreeze on punch: member has returned to the gym!
        const frozenDuration = membership.frozenAt ? Math.max(0, now.getTime() - membership.frozenAt.getTime()) : 0;
        const newEndDate = new Date(membership.endDate.getTime() + frozenDuration);
        await MemberMembership.updateOne(
          { _id: membership._id },
          { $set: { status: 'active', endDate: newEndDate }, $unset: { frozenAt: 1 } },
          session ? { session } : {}
        );
        membership.endDate = newEndDate;
        membership.status = 'active';
        membership.frozenAt = undefined;
      } else if (membership.status !== 'active') {
        await MemberMembership.updateOne(
          { _id: membership._id },
          { $set: { status: 'active' } },
          session ? { session } : {}
        );
        membership.status = 'active';
      }
    }
  }

  // If a valid membership is active today, auto-heal any stale profile statuses
  if (membership) {
    if (member.membershipStatus !== 'active' || member.registrationStatus !== 'active') {
      try {
        await MemberProfile.updateOne(
          { _id: member._id },
          { $set: { membershipStatus: 'active', registrationStatus: 'active' } },
          session ? { session } : {}
        );
        member.membershipStatus = 'active';
        member.registrationStatus = 'active';
      } catch (err) {
        // Non-blocking auto-heal fallback
      }
    }
  } else {
    // 3. No current active membership: evaluate latest membership to provide accurate, specific reason
    if (latestMembership) {
      if (new Date(latestMembership.startDate) > now) {
        const startDateStr = new Date(latestMembership.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const error = new Error(`Membership starts on ${startDateStr}. Check-in not allowed before start date.`);
        error.statusCode = 403;
        error.code = 'MEMBERSHIP_INELIGIBLE';
        error.isExpired = false;
        error.member = memberInfo;
        error.membership = membershipInfo;
        throw error;
      }

      if (latestMembership.paymentStatus !== 'paid') {
        const error = new Error('Membership payment is pending. Please complete payment at reception.');
        error.statusCode = 403;
        error.code = 'MEMBERSHIP_INELIGIBLE';
        error.isExpired = false;
        error.member = memberInfo;
        error.membership = membershipInfo;
        throw error;
      }

      if (latestMembership.status === 'expired' || new Date(latestMembership.endDate) < now) {
        const endDateStr = latestMembership?.endDate ? new Date(latestMembership.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const errorMsg = endDateStr ? `Membership expired on ${endDateStr}. Please renew your plan.` : 'Your gym membership has expired. Please renew your plan.';
        const error = new Error(errorMsg);
        error.statusCode = 403;
        error.code = 'MEMBERSHIP_INELIGIBLE';
        error.isExpired = true;
        error.member = memberInfo;
        error.membership = membershipInfo;
        throw error;
      }
    }

    const error = new Error('No current, paid membership found. Please renew your plan.');
    error.statusCode = 403;
    error.code = 'MEMBERSHIP_INELIGIBLE';
    error.isExpired = false;
    error.member = memberInfo;
    error.membership = membershipInfo;
    throw error;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const { day: currentDay, time: currentTime } = clockAt(now);
  let operatingHours = null;
  try {
    operatingHours = await GymOperatingHours.findOne({ dayOfWeek: currentDay }).session(session);
  } catch (err) {
    operatingHours = null;
  }

  // Practical gym attendance logic:
  // If the member is physically at the scanner punching attendance, the gym is open!
  // Rather than blocking them with "The gym is currently closed", accept the punch
  // and record it under a Special Opening Time.
  const isOutsideScheduledHours = !operatingHours ||
    !operatingHours.isOpen ||
    currentTime < operatingHours.openTime ||
    currentTime >= operatingHours.closeTime ||
    (operatingHours.sessions?.length > 0 && !operatingHours.sessions.some(s => currentTime >= s.startTime && currentTime < s.endTime));

  const isSpecialHours = Boolean(isOutsideScheduledHours);

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

  return { membership, slotAllocation, isSpecialHours, operatingHours };
};


module.exports = { validateAttendanceAccess };
