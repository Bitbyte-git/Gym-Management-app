const { zonedMidnight, addCalendarDays } = require('./gymDate');

const dateRange = (start, end) => {
  const range = {};
  if (start) range.$gte = zonedMidnight(start);
  if (end) range.$lt = zonedMidnight(addCalendarDays(end, 1));
  return range;
};
module.exports = dateRange;
