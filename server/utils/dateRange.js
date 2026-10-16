const dateRange = (start, end) => {
  const range = {};
  if (start) range.$gte = new Date(start);
  if (end) { const through = new Date(end); through.setUTCDate(through.getUTCDate() + 1); range.$lt = through; }
  return range;
};
module.exports = dateRange;
