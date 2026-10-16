const addMonthsClamped = (date, months) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) ||
      !Number.isInteger(months) || months < 0) {
    throw new TypeError('A valid date and a non-negative whole number of months are required');
  }
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
};

module.exports = { addMonthsClamped };
