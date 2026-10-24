const config = require('../config/env');

const dateParts = (date, timeZone = config.gym.timezone) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)])
);

const dateKeyAt = (date = new Date(), timeZone = config.gym.timezone) => {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const zonedMidnight = (dateKey, timeZone = config.gym.timezone) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = dateParts(new Date(instant), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    instant -= represented - target;
  }
  return new Date(instant);
};

const addCalendarDays = (dateKey, amount) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return result.toISOString().slice(0, 10);
};

const gymDayBounds = (date = new Date()) => {
  const key = dateKeyAt(date);
  return { start: zonedMidnight(key), end: zonedMidnight(addCalendarDays(key, 1)), key };
};

module.exports = { dateKeyAt, zonedMidnight, addCalendarDays, gymDayBounds };
