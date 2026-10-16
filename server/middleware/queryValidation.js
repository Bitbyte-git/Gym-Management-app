module.exports = (req, res, next) => {
  const { startDate, endDate } = req.query;
  for (const value of [startDate, endDate]) {
    if (value !== undefined && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime()))) {
      return res.status(400).json({ success: false, error: 'Dates must use YYYY-MM-DD' });
    }
  }
  if (startDate && endDate && startDate > endDate) return res.status(400).json({ success: false, error: 'From date must not exceed through date' });
  next();
};
