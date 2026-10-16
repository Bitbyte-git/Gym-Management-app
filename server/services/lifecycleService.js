const mongoose = require('mongoose');
const MemberMembership = require('../models/MemberMembership');
const MemberProfile = require('../models/MemberProfile');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymTimeSlot = require('../models/GymTimeSlot');
const Notification = require('../models/Notification');
const SystemSetting = require('../models/SystemSetting');
let running = false;
const reconcile = async () => {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await MemberMembership.updateMany({ status: 'active', endDate: { $lt: now } }, { $set: { status: 'expired' } });
    const allocations = await MemberSlotAllocation.find({ status: 'active', endDate: { $lt: now } }).select('_id');
    for (const allocation of allocations) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const current = await MemberSlotAllocation.findOne({ _id: allocation._id, status: 'active', endDate: { $lt: now } }).session(session);
          if (!current) return;
          if (await MemberMembership.exists({ _id: current.membership, status: 'frozen' }).session(session)) return;
          current.status = 'expired'; await current.save({ session });
          const slot = await GymTimeSlot.findOneAndUpdate({ _id: current.timeSlot, currentCapacity: { $gt: 0 } }, { $inc: { currentCapacity: -1 } }, { session });
          if (!slot) throw new Error('Expired allocation capacity is inconsistent');
        });
      } finally { await session.endSession(); }
    }
    const activeIds = await MemberMembership.distinct('member', { status: 'active', paymentStatus: 'paid', startDate: { $lte: now }, endDate: { $gte: now } });
    await MemberProfile.updateMany({ _id: { $nin: activeIds }, registrationStatus: 'active', membershipStatus: 'active' }, { $set: { membershipStatus: 'expired' } });
    await MemberProfile.updateMany({ _id: { $in: activeIds }, registrationStatus: 'active', membershipStatus: 'expired' }, { $set: { membershipStatus: 'active' } });
    const frozenIds = await MemberMembership.distinct('member', { status: 'frozen' });
    await require('../models/TrainerClientAllocation').updateMany({ member: { $nin: [...activeIds, ...frozenIds] }, status: 'active' }, { $set: { status: 'inactive', endDate: now } });
    const reminder = await SystemSetting.findOne({ key: 'membership_expiry_reminder_days' });
    const days = Number.isInteger(reminder?.value) ? Math.max(0, Math.min(reminder.value, 90)) : 7;
    const memberships = await MemberMembership.find({ status: 'active', endDate: { $gte: now, $lte: new Date(now.getTime() + days * 86400000) } }).populate('member', 'user');
    for (const membership of memberships) {
      if (!membership.member) continue;
      const deduplicationKey = `expiry-${membership._id}-${membership.endDate.toISOString().slice(0, 10)}-${now.toISOString().slice(0, 10)}`;
      await Notification.updateOne({ deduplicationKey }, { $setOnInsert: { recipient: membership.member.user,
        type: 'membership_expiry', title: 'Membership expiring soon', message: `Your membership ends on ${membership.endDate.toISOString().slice(0, 10)}.`,
        deliveryStatus: 'sent', sentVia: ['in_app'], relatedData: { membershipId: membership._id } } }, { upsert: true });
    }
  } finally { running = false; }
};
module.exports = { reconcile };
