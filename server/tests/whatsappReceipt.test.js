const test = require('node:test');
const assert = require('node:assert/strict');
const { formatContact, buildTemplateParams } = require('../utils/whatsappReceipt');

test('WhatsApp Receipt - Phone Number Normalization', () => {
  // 10 digits (India)
  assert.equal(formatContact('9876543210'), '919876543210');
  assert.equal(formatContact('98765 43210'), '919876543210');
  assert.equal(formatContact('+91-98765-43210'), '919876543210');

  // 11 digits starting with 0
  assert.equal(formatContact('09876543210'), '919876543210');

  // 12 digits starting with 91
  assert.equal(formatContact('919876543210'), '919876543210');

  // International format
  assert.equal(formatContact('14155552671'), '14155552671');

  // Invalid formats
  assert.equal(formatContact(''), null);
  assert.equal(formatContact('123'), null);
  assert.equal(formatContact(null), null);
});

test('WhatsApp Receipt - Dynamic Template Parameters', () => {
  const dummyData = {
    member: { fullName: 'John Doe' },
    payment: {
      _id: '507f1f77bcf86cd799439011',
      transactionId: 'TXN1001',
      amount: 4999,
      paymentDate: new Date('2026-10-25T10:00:00.000Z'),
    },
  };

  // 1 parameter: Member Name
  assert.equal(buildTemplateParams(1, dummyData), 'John Doe');

  // 2 parameters: Member Name, Receipt ID
  assert.equal(buildTemplateParams(2, dummyData), 'John Doe,TXN1001');

  // 3 parameters: Member Name, Receipt ID, Date
  const param3 = buildTemplateParams(3, dummyData);
  assert.ok(param3.startsWith('John Doe,TXN1001,'));

  // 4 parameters: Member Name, Receipt ID, Amount, Date
  const param4 = buildTemplateParams(4, dummyData);
  assert.ok(param4.startsWith('John Doe,TXN1001,Rs 4999.00,'));

  // Comma sanitization in member name
  const commaData = {
    member: { fullName: 'Doe, John' },
    payment: { transactionId: 'TXN1002', amount: 1000 },
  };
  assert.equal(buildTemplateParams(1, commaData), 'Doe  John');
});
