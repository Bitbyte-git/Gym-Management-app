const GymOperatingHours = require('../models/GymOperatingHours');
const config = require('../config/env');
const failure = message => Object.assign(new Error(message), { statusCode: 409 });
const clockAt = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.gym.timezone,
    weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return { day: get('weekday').toLowerCase(), time: `${get('hour')}:${get('minute')}` };
};
const fitsHours = (slot, hours) => Boolean(hours?.isOpen && slot.startTime >= hours.openTime &&
  slot.endTime <= hours.closeTime && (!hours.sessions?.length || hours.sessions.some(session =>
    slot.startTime >= session.startTime && slot.endTime <= session.endTime)));
const validateSlotHours = async (slot, session = null) => {
  const hours = await GymOperatingHours.findOne({ dayOfWeek: slot.dayOfWeek }).session(session);
  if (!fitsHours(slot, hours)) throw failure('The selected slot is outside configured gym sessions. Choose another slot.');
};
const coversSlot = (availability, slot) => availability.isActive && availability.dayOfWeek === slot.dayOfWeek &&
  availability.startTime <= slot.startTime && availability.endTime >= slot.endTime &&
  !(availability.breakStartTime && availability.breakStartTime < slot.endTime && availability.breakEndTime > slot.startTime);
module.exports = { clockAt, fitsHours, validateSlotHours, coversSlot, failure };
