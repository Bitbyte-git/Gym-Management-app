const config = require('../config/env');

const SESSIONS = {
  morning: {
    key: 'morning',
    label: 'Morning Session',
    startTime: '05:00',
    endTime: '11:59',
  },
  afternoon: {
    key: 'afternoon',
    label: 'Afternoon Session',
    startTime: '12:00',
    endTime: '15:59',
  },
  evening: {
    key: 'evening',
    label: 'Evening Session',
    startTime: '16:00',
    endTime: '22:00',
  },
};

/**
 * Returns 24-hour time "HH:MM" in the gym's configured timezone.
 */
const timeInGymTimezone = (date = new Date(), timeZone = config.gym.timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
};

/**
 * Returns the session name ('morning' | 'afternoon' | 'evening') for a given timestamp.
 * - Morning: 5:00 AM to 11:59 AM (05:00 - 11:59)
 * - Afternoon: 12:00 PM to 3:59 PM (12:00 - 15:59)
 * - Evening: 4:00 PM to 10:00 PM (16:00 - 22:00)
 */
const getSessionName = (date = new Date(), timeZone = config.gym.timezone) => {
  const time = timeInGymTimezone(date, timeZone);
  if (time < '12:00') return 'morning';
  if (time < '16:00') return 'afternoon';
  return 'evening';
};

/**
 * Formats a duration in minutes into a human-readable string:
 * - 45 -> "45m"
 * - 60 -> "1h"
 * - 90 -> "1h 30m"
 * - 150 -> "2h 30m"
 */
const formatDuration = (minutes = 0) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return '0m';
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/**
 * Formats duration in decimal hours (e.g. 90 -> 1.5, 150 -> 2.5)
 */
const formatDecimalHours = (minutes = 0) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return Number((total / 60).toFixed(2));
};

/**
 * Aggregates all attendance records for a member across a day or set of visits.
 * Returns total spending hours and per-session breakdown.
 */
const calculateDailySpending = (records = []) => {
  const breakdown = {
    morning: 0,
    afternoon: 0,
    evening: 0,
  };

  let totalMinutes = 0;
  const sessionsAttended = [];

  for (const record of records) {
    const session = record.sessionName || getSessionName(record.checkInTime);
    const dur = Math.max(0, Number(record.duration) || 0);
    if (breakdown[session] !== undefined) {
      breakdown[session] += dur;
    }
    totalMinutes += dur;
    if (!sessionsAttended.includes(session)) {
      sessionsAttended.push(session);
    }
  }

  return {
    totalMinutes,
    totalHoursFormatted: formatDuration(totalMinutes),
    totalHoursDecimal: formatDecimalHours(totalMinutes),
    sessionsCount: sessionsAttended.length,
    sessionsAttended,
    breakdown: {
      morningMinutes: breakdown.morning,
      morningFormatted: formatDuration(breakdown.morning),
      afternoonMinutes: breakdown.afternoon,
      afternoonFormatted: formatDuration(breakdown.afternoon),
      eveningMinutes: breakdown.evening,
      eveningFormatted: formatDuration(breakdown.evening),
    },
  };
};

module.exports = {
  SESSIONS,
  timeInGymTimezone,
  getSessionName,
  formatDuration,
  formatDecimalHours,
  calculateDailySpending,
};
