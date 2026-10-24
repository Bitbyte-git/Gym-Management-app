const test = require('node:test');
const assert = require('node:assert/strict');
const GymTimeSlot = require('../models/GymTimeSlot');
const TrainerAvailability = require('../models/TrainerAvailability');
const MemberAttendance = require('../models/MemberAttendance');
const TrainerProfile = require('../models/TrainerProfile');
const dateRange = require('../utils/dateRange');

test('time slot schema rejects overlapping-invalid time order and invalid capacity', async () => {
  const slot = new GymTimeSlot({
    name: 'Morning',
    dayOfWeek: 'monday',
    startTime: '10:00',
    endTime: '09:00',
    maxCapacity: 0,
  });
  await assert.rejects(slot.validate(), /end after it starts|positive whole number/);
});

test('trainer availability requires an in-range complete break', async () => {
  const availability = new TrainerAvailability({
    trainer: '507f1f77bcf86cd799439011',
    dayOfWeek: 'monday',
    startTime: '09:00',
    endTime: '17:00',
    breakStartTime: '16:00',
    breakEndTime: '18:00',
  });
  await assert.rejects(availability.validate(), /Break must have valid times/);
});

test('attendance schema has an active-session uniqueness constraint', () => {
  const activeSessionIndex = MemberAttendance.schema.indexes().find(([fields, options]) =>
    fields.member === 1 &&
    options.unique === true &&
    options.partialFilterExpression?.sessionOpen === true
  );
  assert.ok(activeSessionIndex);
});

test('trainer requires gender and at least one convenient timing', async () => {
  const trainer = new TrainerProfile({
    user: '507f1f77bcf86cd799439011', trainerId: 'TRN-TEST', fullName: 'Test Trainer',
    gender: 'male', mobileNumber: '9000000000', email: 'trainer@test.local',
    specialization: 'Strength', experience: 2, convenientTimings: [],
  });
  await assert.rejects(trainer.validate(), /Select at least one convenient timing/);
});

test('report date ranges use inclusive Bengaluru calendar days', () => {
  const range = dateRange('2026-10-20', '2026-10-21');
  assert.equal(range.$gte.toISOString(), '2026-10-19T18:30:00.000Z');
  assert.equal(range.$lt.toISOString(), '2026-10-21T18:30:00.000Z');
});
