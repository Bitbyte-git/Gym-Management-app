const test = require('node:test');
const assert = require('node:assert/strict');
const { addMonthsClamped } = require('../utils/date');

test('addMonthsClamped preserves the day when present in the target month', () => {
  const date = addMonthsClamped(new Date(2025, 0, 15, 12), 1);
  assert.equal(date.getFullYear(), 2025);
  assert.equal(date.getMonth(), 1);
  assert.equal(date.getDate(), 15);
  assert.equal(date.getHours(), 12);
});

test('addMonthsClamped clamps dates at the end of shorter months', () => {
  const leapYearDate = addMonthsClamped(new Date(2024, 0, 31, 12), 1);
  assert.equal(leapYearDate.getMonth(), 1);
  assert.equal(leapYearDate.getDate(), 29);
  const regularYearDate = addMonthsClamped(new Date(2025, 0, 31, 12), 1);
  assert.equal(regularYearDate.getMonth(), 1);
  assert.equal(regularYearDate.getDate(), 28);
});

test('addMonthsClamped rejects invalid inputs', () => {
  assert.throws(() => addMonthsClamped(new Date(Number.NaN), 1), TypeError);
  assert.throws(() => addMonthsClamped(new Date(), -1), TypeError);
});
