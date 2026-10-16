const TrainerProfile = require('../models/TrainerProfile');
const TrainerAvailability = require('../models/TrainerAvailability');
const TrainerClientAllocation = require('../models/TrainerClientAllocation');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const { coversSlot, failure } = require('../utils/schedule');
const checkTrainer = async (trainerId, slot, session = null, reserve = false) => {
  const trainer = reserve
    ? await TrainerProfile.findOneAndUpdate({ _id: trainerId, status: 'active' }, { $inc: { allocationVersion: 1 } }, { returnDocument: 'after', session })
    : await TrainerProfile.findOne({ _id: trainerId, status: 'active' }).session(session);
  if (!trainer) throw failure('Trainer is not available');
  const availabilities = await TrainerAvailability.find({ trainer: trainerId, isActive: true }).session(session);
  const matches = slot ? availabilities.filter(availability => coversSlot(availability, slot)) : [];
  if (!matches.length) throw failure('Trainer availability does not cover the selected slot, or overlaps a break');
  const count = await TrainerClientAllocation.countDocuments({ trainer: trainerId, status: 'active' }).session(session);
  if (count >= Math.max(...matches.map(item => item.maxClients))) throw failure('Trainer has reached client capacity');
  return trainer;
};
const assignTrainer = async ({ trainerId, memberId, slot, session, assignedBy, notes }) => {
  if (!slot) {
    const allocation = await MemberSlotAllocation.findOne({ member: memberId, status: 'active' }).populate('timeSlot').session(session);
    slot = allocation?.timeSlot;
  }
  await checkTrainer(trainerId, slot, session, true);
  if (await TrainerClientAllocation.exists({ member: memberId, status: 'active' }).session(session)) throw failure('Member already has an active trainer');
  const [allocation] = await TrainerClientAllocation.create([{ trainer: trainerId, member: memberId,
    status: 'active', startDate: new Date(), assignedBy, notes }], { session });
  const member = await require('../models/MemberProfile').findById(memberId).session(session);
  if (member) await require('../models/Notification').create([{ recipient: member.user,
    type: 'trainer_assignment', title: 'Trainer assigned', message: 'Your trainer assignment has been updated.',
    relatedData: { trainer: trainerId }, deliveryStatus: 'sent', sentVia: ['in_app'] }], { session });
  return allocation;
};
module.exports = { checkTrainer, assignTrainer };

module.exports.validateAssignedTrainer = async (memberId, slot, session) => {
  const assignment = await TrainerClientAllocation.findOne({ member: memberId, status: 'active' }).session(session);
  if (!assignment) return;
  const trainer = await TrainerProfile.findOneAndUpdate({ _id: assignment.trainer, status: 'active' },
    { $inc: { allocationVersion: 1 } }, { returnDocument: 'after', session });
  if (!trainer) throw failure('Assigned trainer is currently unavailable. Reassign or remove the trainer first.');
  const schedules = await TrainerAvailability.find({ trainer: assignment.trainer, isActive: true }).session(session);
  if (!schedules.some(schedule => coversSlot(schedule, slot))) throw failure('New slot conflicts with the assigned trainer schedule or break');
};
