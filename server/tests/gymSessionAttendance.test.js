const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getSessionName,
  formatDuration,
  formatDecimalHours,
  calculateDailySpending,
  SESSIONS,
} = require('../utils/gymSession');

test('3 Daily Gym Sessions definitions', () => {
  assert.equal(SESSIONS.morning.startTime, '05:00');
  assert.equal(SESSIONS.morning.endTime, '11:59');
  assert.equal(SESSIONS.afternoon.startTime, '12:00');
  assert.equal(SESSIONS.afternoon.endTime, '15:59');
  assert.equal(SESSIONS.evening.startTime, '16:00');
  assert.equal(SESSIONS.evening.endTime, '22:00');
});

test('getSessionName maps timestamps into the 3 defined sessions (IST Asia/Kolkata)', () => {
  // 5:00 AM IST (23:30 UTC previous day) -> morning
  const morningStart = new Date('2026-10-26T05:00:00+05:30');
  assert.equal(getSessionName(morningStart, 'Asia/Kolkata'), 'morning');

  // 8:30 AM IST -> morning
  const morningMid = new Date('2026-10-26T08:30:00+05:30');
  assert.equal(getSessionName(morningMid, 'Asia/Kolkata'), 'morning');

  // 11:59 AM IST -> morning
  const morningEnd = new Date('2026-10-26T11:59:00+05:30');
  assert.equal(getSessionName(morningEnd, 'Asia/Kolkata'), 'morning');

  // 12:00 PM IST -> afternoon
  const afternoonStart = new Date('2026-10-26T12:00:00+05:30');
  assert.equal(getSessionName(afternoonStart, 'Asia/Kolkata'), 'afternoon');

  // 2:15 PM IST -> afternoon
  const afternoonMid = new Date('2026-10-26T14:15:00+05:30');
  assert.equal(getSessionName(afternoonMid, 'Asia/Kolkata'), 'afternoon');

  // 3:59 PM IST -> afternoon
  const afternoonEnd = new Date('2026-10-26T15:59:00+05:30');
  assert.equal(getSessionName(afternoonEnd, 'Asia/Kolkata'), 'afternoon');

  // 4:00 PM IST -> evening
  const eveningStart = new Date('2026-10-26T16:00:00+05:30');
  assert.equal(getSessionName(eveningStart, 'Asia/Kolkata'), 'evening');

  // 7:30 PM IST -> evening
  const eveningMid = new Date('2026-10-26T19:30:00+05:30');
  assert.equal(getSessionName(eveningMid, 'Asia/Kolkata'), 'evening');

  // 10:00 PM IST -> evening
  const eveningEnd = new Date('2026-10-26T22:00:00+05:30');
  assert.equal(getSessionName(eveningEnd, 'Asia/Kolkata'), 'evening');
});

test('formatDuration formats minutes cleanly into human-readable hours and minutes', () => {
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(60), '1h');
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(150), '2h 30m');
  assert.equal(formatDuration(195), '3h 15m');
});

test('formatDecimalHours formats duration in decimal hours', () => {
  assert.equal(formatDecimalHours(60), 1.0);
  assert.equal(formatDecimalHours(90), 1.5);
  assert.equal(formatDecimalHours(150), 2.5);
});

test('calculateDailySpending calculates spending for single and multi-session members', () => {
  // Case A: Member only coming in morning for 1 hour
  const morningOnlyRecords = [
    {
      sessionName: 'morning',
      checkInTime: new Date('2026-10-26T06:00:00+05:30'),
      checkOutTime: new Date('2026-10-26T07:00:00+05:30'),
      duration: 60,
    },
  ];
  const morningSpending = calculateDailySpending(morningOnlyRecords);
  assert.equal(morningSpending.totalMinutes, 60);
  assert.equal(morningSpending.totalHoursFormatted, '1h');
  assert.equal(morningSpending.totalHoursDecimal, 1.0);
  assert.equal(morningSpending.breakdown.morningMinutes, 60);
  assert.equal(morningSpending.breakdown.morningFormatted, '1h');
  assert.equal(morningSpending.breakdown.eveningMinutes, 0);

  // Case B: Member spending 1h 30m in morning and 1h in evening -> total 2h 30m (2.5 hr)
  const multiSessionRecords = [
    {
      sessionName: 'morning',
      checkInTime: new Date('2026-10-26T06:00:00+05:30'),
      checkOutTime: new Date('2026-10-26T07:30:00+05:30'),
      duration: 90,
    },
    {
      sessionName: 'evening',
      checkInTime: new Date('2026-10-26T17:00:00+05:30'),
      checkOutTime: new Date('2026-10-26T18:00:00+05:30'),
      duration: 60,
    },
  ];
  const multiSpending = calculateDailySpending(multiSessionRecords);
  assert.equal(multiSpending.totalMinutes, 150);
  assert.equal(multiSpending.totalHoursFormatted, '2h 30m');
  assert.equal(multiSpending.totalHoursDecimal, 2.5);
  assert.equal(multiSpending.sessionsCount, 2);
  assert.deepEqual(multiSpending.sessionsAttended, ['morning', 'evening']);
  assert.equal(multiSpending.breakdown.morningMinutes, 90);
  assert.equal(multiSpending.breakdown.morningFormatted, '1h 30m');
  assert.equal(multiSpending.breakdown.afternoonMinutes, 0);
  assert.equal(multiSpending.breakdown.eveningMinutes, 60);
  assert.equal(multiSpending.breakdown.eveningFormatted, '1h');
});

test('Multi-punch in same session notes all punches and keeps last punch for checkout', () => {
  const punches = [];
  let checkInTime = null;
  let checkOutTime = null;
  let duration = 0;

  // First punch: Check-in at 06:00 AM
  const p1 = new Date('2026-10-26T06:00:00+05:30');
  checkInTime = p1;
  punches.push({ punchTime: p1, punchType: 'checkin' });

  assert.equal(punches.length, 1);
  assert.equal(checkOutTime, null);

  // Second punch at 06:45 AM (intermediate or checkout)
  const p2 = new Date('2026-10-26T06:45:00+05:30');
  punches.push({ punchTime: p2, punchType: 'checkout' });
  checkOutTime = p2;
  duration = Math.round((checkOutTime - checkInTime) / 60000);

  assert.equal(punches.length, 2);
  assert.equal(checkOutTime, p2);
  assert.equal(duration, 45); // 45m

  // Third punch at 07:30 AM (member scans again on exit, machine notes timestamp, overwrites checkout)
  const p3 = new Date('2026-10-26T07:30:00+05:30');
  punches.push({ punchTime: p3, punchType: 'checkout' });
  checkOutTime = p3;
  duration = Math.round((checkOutTime - checkInTime) / 60000);

  assert.equal(punches.length, 3);
  assert.equal(checkOutTime, p3);
  assert.equal(duration, 90); // 1h 30m
  assert.equal(formatDuration(duration), '1h 30m');
});

test('5-minute Check-in Grace Period: punch within 5 min reconfirms check-in without closing session', () => {
  const CHECKIN_GRACE_PERIOD_MS = 5 * 60 * 1000;
  const punches = [];
  let sessionOpen = true;
  let checkInTime = new Date('2026-10-27T12:00:00+05:30'); // 12:00 PM Afternoon session
  let checkOutTime = null;
  let duration = 0;

  // Punch 1 (12:00:00 PM): Initial Check-in
  punches.push({ punchTime: checkInTime, punchType: 'checkin' });
  assert.equal(sessionOpen, true);
  assert.equal(checkOutTime, null);

  // Punch 2 (12:01:30 PM): Confused 90 seconds later -> within 5-min grace period!
  const p2 = new Date('2026-10-27T12:01:30+05:30');
  const elapsedP2 = p2 - checkInTime;
  assert.ok(elapsedP2 < CHECKIN_GRACE_PERIOD_MS);
  // Grace period behavior: reconfirm check-in, do NOT checkout!
  punches.push({ punchTime: p2, punchType: 'punch' });
  assert.equal(sessionOpen, true); // Still open!
  assert.equal(checkOutTime, null); // Still null!

  // Punch 3 (12:45:00 PM): 45 minutes later -> checkout!
  const p3 = new Date('2026-10-27T12:45:00+05:30');
  const elapsedP3 = p3 - checkInTime;
  assert.ok(elapsedP3 >= CHECKIN_GRACE_PERIOD_MS);
  punches.push({ punchTime: p3, punchType: 'checkout' });
  sessionOpen = false;
  checkOutTime = p3;
  duration = Math.round((checkOutTime - checkInTime) / 60000);
  assert.equal(sessionOpen, false);
  assert.equal(checkOutTime, p3);
  assert.equal(duration, 45); // 45m workout

  // Punch 4 (12:48:00 PM): 3 minutes after checkout in same session -> updates checkout with last punch!
  const p4 = new Date('2026-10-27T12:48:00+05:30');
  punches.push({ punchTime: p4, punchType: 'checkout' });
  checkOutTime = p4;
  duration = Math.round((checkOutTime - checkInTime) / 60000);
  assert.equal(punches.length, 4);
  assert.equal(checkOutTime, p4);
  assert.equal(duration, 48); // 48m workout
});

test('Session end time calculation and isSessionExpired detection', () => {
  const { getSessionEndTime, isSessionExpired, calculateAutoCheckout } = require('../utils/gymSession');

  // Morning check-in: 08:00 AM IST on 2026-10-28
  const morningCheckIn = new Date('2026-10-28T08:00:00+05:30');
  const morningEnd = getSessionEndTime(morningCheckIn, 'morning', 'Asia/Kolkata');
  // 11:59 AM IST = 06:29 UTC
  assert.equal(morningEnd.toISOString(), '2026-10-28T06:29:00.000Z');

  // At 10:30 AM (during morning session) -> NOT expired
  const duringMorning = new Date('2026-10-28T10:30:00+05:30');
  assert.equal(isSessionExpired({ checkInTime: morningCheckIn, sessionName: 'morning' }, duringMorning, 'Asia/Kolkata'), false);

  // At 12:05 PM (afternoon session begins) -> Morning session IS expired
  const afterMorning = new Date('2026-10-28T12:05:00+05:30');
  assert.equal(isSessionExpired({ checkInTime: morningCheckIn, sessionName: 'morning' }, afterMorning, 'Asia/Kolkata'), true);

  // Afternoon check-in: 01:00 PM IST -> ends at 03:59 PM (10:29 UTC)
  const afternoonCheckIn = new Date('2026-10-28T13:00:00+05:30');
  const afternoonEnd = getSessionEndTime(afternoonCheckIn, 'afternoon', 'Asia/Kolkata');
  assert.equal(afternoonEnd.toISOString(), '2026-10-28T10:29:00.000Z');

  // Evening check-in: 06:00 PM IST -> ends at 10:00 PM (16:30 UTC)
  const eveningCheckIn = new Date('2026-10-28T18:00:00+05:30');
  const eveningEnd = getSessionEndTime(eveningCheckIn, 'evening', 'Asia/Kolkata');
  assert.equal(eveningEnd.toISOString(), '2026-10-28T16:30:00.000Z');
});

test('Auto-checkout at session end: duration does NOT run continuously when member forgets to check out', () => {
  const { calculateAutoCheckout } = require('../utils/gymSession');

  // Case 1: Member checked in at 8:00 AM (Morning session: 05:00 - 11:59) and forgot to check out
  const morningCheckIn = new Date('2026-10-28T08:00:00+05:30');
  // Later at 5:00 PM (9 hours later)
  const nowEvening = new Date('2026-10-28T17:00:00+05:30');

  const auto = calculateAutoCheckout({ checkInTime: morningCheckIn, sessionName: 'morning' }, nowEvening, 'Asia/Kolkata');

  // Verify checkout time is clamped to Morning session end (11:59:00 AM IST), NOT 5:00 PM!
  assert.equal(auto.checkOutTime.toISOString(), '2026-10-28T06:29:00.000Z');
  // Duration: 08:00 to 11:59 = 239 minutes (3h 59m), NOT 540 minutes (9 hours)!
  assert.equal(auto.duration, 239);
  assert.equal(auto.sessionOpen, false);
  assert.ok(auto.notes.includes('Auto-closed at session end'));

  // Case 2: Member checked in at 1:00 PM (Afternoon session: 12:00 - 15:59) and forgot to check out
  const afternoonCheckIn = new Date('2026-10-28T13:00:00+05:30');
  const nowNight = new Date('2026-10-28T21:00:00+05:30');
  const autoAfternoon = calculateAutoCheckout({ checkInTime: afternoonCheckIn, sessionName: 'afternoon' }, nowNight, 'Asia/Kolkata');
  assert.equal(autoAfternoon.checkOutTime.toISOString(), '2026-10-28T10:29:00.000Z'); // 15:59 IST
  assert.equal(autoAfternoon.duration, 179); // 13:00 to 15:59 = 179 min (2h 59m)
  assert.equal(autoAfternoon.sessionOpen, false);

  // Case 3: Member checked in at 7:00 PM (Evening session: 16:00 - 22:00) and forgot to check out
  const eveningCheckIn = new Date('2026-10-28T19:00:00+05:30');
  const nextMorning = new Date('2026-10-29T06:00:00+05:30');
  const autoEvening = calculateAutoCheckout({ checkInTime: eveningCheckIn, sessionName: 'evening' }, nextMorning, 'Asia/Kolkata');
  assert.equal(autoEvening.checkOutTime.toISOString(), '2026-10-28T16:30:00.000Z'); // 22:00 IST
  assert.equal(autoEvening.duration, 180); // 19:00 to 22:00 = 180 min (3h)
  assert.equal(autoEvening.sessionOpen, false);
});
