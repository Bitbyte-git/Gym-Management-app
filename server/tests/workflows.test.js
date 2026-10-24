const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-access-secret-only-for-isolated-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-only-for-isolated-tests';
process.env.PAYMENT_GATEWAY_ENABLED = 'true';
process.env.RAZORPAY_KEY_ID = 'rzp_test_isolated';
process.env.RAZORPAY_KEY_SECRET = 'razorpay-test-secret';
const orders = new Map();
const gatewayPayments = new Map();
let checkoutCounter = 0;
const refunds = new Map();
const actualFetch = global.fetch;
global.fetch = async (input, options = {}) => {
  const url = String(input);
  if (!url.startsWith('https://api.razorpay.com/v1')) return actualFetch(input, options);
  const path = url.replace('https://api.razorpay.com/v1', '');
  let data;
  if (path === '/orders' && options.method === 'POST') {
    const body = JSON.parse(options.body); const id = `order_test_${++checkoutCounter}`;
    data = { id, amount: body.amount, currency: body.currency, receipt: body.receipt, notes: body.notes, status: 'created' };
    orders.set(id, data);
  } else if (/^\/orders\/[^/]+\/payments$/.test(path)) {
    const orderId = path.split('/')[2]; data = { items: [...gatewayPayments.values()].filter(payment => payment.order_id === orderId) };
  } else if (path.startsWith('/orders/')) data = orders.get(path.split('/')[2]);
  else if (path.startsWith('/payments/') && path.endsWith('/refund')) {
    const paymentId = path.split('/')[2]; const body = JSON.parse(options.body);
    const existing = [...refunds.values()].find(refund => refund.payment_id === paymentId);
    data = existing || { id: `rfnd_test_${refunds.size + 1}`, payment_id: paymentId, amount: body.amount, currency: 'INR', status: 'processed' };
    refunds.set(data.id, data);
  } else if (path.startsWith('/payments/')) data = gatewayPayments.get(path.split('/')[2]);
  return new Response(JSON.stringify(data || { error: { description: 'Not found' } }), {
    status: data ? 200 : 404, headers: { 'Content-Type': 'application/json' },
  });
};
let database, server, base, tokens = {}, plan, slot, trainer;
const User = require('../models/User');
const MemberProfile = require('../models/MemberProfile');
const MemberMembership = require('../models/MemberMembership');
const MemberSlotAllocation = require('../models/MemberSlotAllocation');
const GymTimeSlot = require('../models/GymTimeSlot');
const Payment = require('../models/Payment');
const Attendance = require('../models/MemberAttendance');
const Notification = require('../models/Notification');
const authHeaders = role => ({ Authorization: `Bearer ${tokens[role]}` });
async function request(method, path, body, headers = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json(); return { status: response.status, ...data };
}
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, binary: { version: '8.0.12' } });
  process.env.MONGODB_URI = database.getUri('pulsefit_workflow_tests');
  execFileSync(process.execPath, ['server/seed.js'], { env: { ...process.env }, stdio: 'pipe' });
  await mongoose.connect(process.env.MONGODB_URI);
  for (const model of Object.values(mongoose.models)) await model.init();
  const { app } = require('../index');
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  plan = await require('../models/MembershipPlan').findOne({ name: 'Basic' });
  slot = await GymTimeSlot.findOne({ dayOfWeek: 'monday', name: 'Morning Regular' });
  trainer = await require('../models/TrainerProfile').findOne();
}, { timeout: 240000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); global.fetch = actualFetch; });

test('all four seeded roles authenticate with persisted profiles', async () => {
  for (const role of ['admin', 'reception', 'trainer', 'member']) {
    const result = await request('POST', '/auth/login', { email: `${role}@pulsefit.com`, password: `${role}123` });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.user.role, role); tokens[role] = result.data.accessToken;
    if (role === 'member' || role === 'trainer') assert.ok(result.data.user.profile._id);
  }
});
test('backend rejects role escalation and cross-member financial access', async () => {
  assert.equal((await request('GET', '/settings', undefined, authHeaders('member'))).status, 403);
  assert.equal((await request('GET', '/trainers', undefined, authHeaders('reception'))).status, 403);
  assert.equal((await request('POST', '/auth/login', { email: { $ne: null }, password: 'irrelevant' })).status, 400);
  const unrelated = new mongoose.Types.ObjectId();
  assert.equal((await request('GET', `/payments/member/${unrelated}`, undefined, authHeaders('member'))).status, 403);
});
test('admin dashboard returns chart-ready analytics datasets', async () => {
  const result = await request('GET', '/dashboard/admin', undefined, authHeaders('admin'));
  assert.equal(result.status, 200, JSON.stringify(result));
  for (const key of ['attendanceTrend', 'revenueTrend', 'membershipDistribution', 'paymentMethodDistribution', 'slotUtilization']) {
    assert.ok(Array.isArray(result.data[key]), `${key} must be an array`);
  }
});
test('reception can edit an existing time slot but cannot delete it', async () => {
  const editable = await GymTimeSlot.findOne({ status: 'active', currentCapacity: 0 });
  const newCapacity = editable.maxCapacity + 5;
  const updated = await request('PUT', `/time-slots/${editable.id}`, { maxCapacity: newCapacity }, authHeaders('reception'));
  assert.equal(updated.status, 200, JSON.stringify(updated));
  assert.equal(updated.data.maxCapacity, newCapacity);
  assert.equal((await GymTimeSlot.findById(editable.id)).maxCapacity, newCapacity);
  assert.equal((await request('DELETE', `/time-slots/${editable.id}`, undefined, authHeaders('reception'))).status, 403);
});
test('refresh tokens rotate immediately and old token replay fails', async () => {
  const login = await request('POST', '/auth/login', { email: 'member@pulsefit.com', password: 'member123' });
  const rotated = await request('POST', '/auth/refresh', { refreshToken: login.data.refreshToken });
  assert.equal(rotated.status, 200); assert.notEqual(rotated.data.refreshToken, login.data.refreshToken);
  assert.equal((await request('POST', '/auth/refresh', { refreshToken: login.data.refreshToken })).status, 401);
});
let registered, registrationHeaders;
test('self-registration skips biometrics, persists pending payment and is duplicate-resistant', async () => {
  const basic = await request('POST', '/registration/basic-details', {
    email: 'newmember@example.com', password: 'test-password-123', firstName: 'New', lastName: 'Member',
    dateOfBirth: '1998-03-10', gender: 'other', mobile: '9000000011', emergencyContactName: 'Family', emergencyContactPhone: '9000000012',
  });
  assert.equal(basic.status, 201, JSON.stringify(basic)); registrationHeaders = { 'X-Registration-Token': basic.data.registrationToken };
  assert.equal((await request('POST', '/registration/health-details', { height: 170, weight: 65, fitnessGoal: 'general_fitness', exerciseExperience: 'beginner', healthConsent: true }, registrationHeaders)).status, 200);
  assert.equal((await request('POST', '/registration/selection', { planId: plan.id, slotId: slot.id, trainerId: trainer.id }, registrationHeaders)).status, 200);
  const results = await Promise.all([request('POST', '/registration/complete', {}, registrationHeaders), request('POST', '/registration/complete', {}, registrationHeaders)]);
  assert.ok(results.some(result => result.status === 201));
  assert.equal(await MemberProfile.countDocuments({ fullName: 'New Member' }), 1);
  const member = await MemberProfile.findOne({ fullName: 'New Member' });
  registered = await MemberMembership.findOne({ member: member._id });
  assert.equal(registered.status, 'pending'); assert.equal(member.registrationStatus, 'pending_payment');
  assert.equal((await User.findById(member.user)).isActive, false);
});
test('trainer selection filters by slot schedule and break', async () => {
  const monday = await request('GET', `/registration/trainers?slotId=${slot.id}`);
  assert.ok(monday.data.some(item => item._id === trainer.id));
  const sunday = await GymTimeSlot.findOne({ dayOfWeek: 'sunday' });
  const filtered = await request('GET', `/registration/trainers?slotId=${sunday.id}`);
  assert.equal(filtered.data.length, 0);
});
test('Razorpay checkout takes its amount from the server and does not activate before verification', async () => {
  const checkout = await request('POST', '/registration/checkout', { amount: 1 }, registrationHeaders);
  assert.equal(checkout.status, 200, JSON.stringify(checkout));
  const order = orders.get(checkout.data.orderId); assert.equal(order.amount, plan.price * 100);
  assert.equal((await MemberMembership.findById(registered._id)).status, 'pending');
  const second = await request('POST', '/registration/checkout', {}, registrationHeaders);
  assert.equal(second.data.orderId, checkout.data.orderId);
});
test('unsigned or altered Razorpay responses are rejected', async () => {
  const order = [...orders.values()][0];
  const result = await request('POST', '/registration/verify-payment', { razorpay_order_id: order.id, razorpay_payment_id: 'pay_bad', razorpay_signature: 'bad' }, registrationHeaders);
  assert.equal(result.status, 400);
  assert.equal((await MemberMembership.findById(registered._id)).status, 'pending');
});
test('captured Razorpay payment activates membership and records allocations and receipt', async () => {
  const order = [...orders.values()][0]; order.status = 'paid';
  const payment = { id: 'pay_test_1', order_id: order.id, amount: order.amount, currency: 'INR', status: 'captured' };
  gatewayPayments.set(payment.id, payment);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${order.id}|${payment.id}`).digest('hex');
  const verified = await request('POST', '/registration/verify-payment', { razorpay_order_id: order.id, razorpay_payment_id: payment.id, razorpay_signature: signature }, registrationHeaders);
  assert.equal(verified.status, 201, JSON.stringify(verified));
  const membership = await MemberMembership.findById(registered._id);
  assert.equal(membership.status, 'active'); assert.equal(membership.paymentStatus, 'paid');
  assert.equal(await Payment.countDocuments({ membership: membership._id, paymentStatus: 'completed' }), 1);
  assert.equal(await MemberSlotAllocation.countDocuments({ member: membership.member, status: 'active' }), 1);
  assert.equal(await require('../models/TrainerClientAllocation').countDocuments({ member: membership.member, status: 'active' }), 1);
  const profile = await MemberProfile.findById(membership.member); assert.equal(profile.registrationStatus, 'active');
  assert.equal((await User.findById(profile.user)).isActive, true);
  assert.equal(await Notification.countDocuments({ recipient: profile.user, type: 'payment_receipt' }), 1);
  assert.equal((await request('GET', '/registration/summary', undefined, registrationHeaders)).data.status, 'completed');
});
test('notification updates cannot mark another user?s notification as read', async () => {
  const notification = await Notification.findOne({ type: 'payment_receipt' });
  assert.equal((await request('PUT', `/notifications/${notification.id}/read`, {}, authHeaders('member'))).status, 404);
  assert.equal((await Notification.findById(notification._id)).isRead, false);
});
test('slot changes commit capacity updates and return the created allocation', async () => {
  const allocation = await MemberSlotAllocation.findOne({ member: registered.member, status: 'active' });
  const other = await GymTimeSlot.findOne({ dayOfWeek: 'monday', name: 'Evening Early' });
  const result = await request('PUT', `/time-slots/change/${allocation.id}`, { newSlotId: other.id }, authHeaders('admin'));
  assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.data.timeSlot, other.id);
  assert.equal((await GymTimeSlot.findById(other._id)).currentCapacity, 1);
  assert.equal((await MemberSlotAllocation.findById(allocation._id)).status, 'cancelled');
});
test('trainer assignments reject capacity exhaustion', async () => {
  const availability = require('../models/TrainerAvailability');
  await availability.updateMany({ trainer: trainer._id }, { $set: { maxClients: 1 } });
  const demo = await MemberProfile.findOne({ fullName: 'Demo Member' });
  const result = await request('POST', '/trainer-allocations', { memberId: demo.id, trainerId: trainer.id }, authHeaders('admin'));
  assert.equal(result.status, 409, JSON.stringify(result));
});
test('cross-midnight open attendance is unique and can be checked out', async () => {
  const demo = await MemberProfile.findOne({ fullName: 'Demo Member' });
  const yesterday = new Date(Date.now() - 86400000);
  await Attendance.create({ member: demo._id, attendanceDate: yesterday, checkInTime: yesterday, deviceId: 'MANUAL' });
  await assert.rejects(Attendance.create({ member: demo._id, attendanceDate: new Date(), checkInTime: new Date() }), error => error.code === 11000);
  const result = await request('POST', '/attendance/manual-checkout', { memberId: demo.id, notes: 'Close yesterday session' }, authHeaders('reception'));
  assert.equal(result.status, 200, JSON.stringify(result)); assert.ok(result.data.duration >= 1440); assert.equal(result.data.sessionOpen, false);
});
test('plan deactivation preserves membership references and filters exclude bad dates', async () => {
  assert.equal((await request('GET', '/reports/revenue?startDate=invalid', undefined, authHeaders('admin'))).status, 400);
  const result = await request('DELETE', `/membership-plans/${plan.id}`, undefined, authHeaders('admin')); assert.equal(result.status, 200);
  const existing = await require('../models/MembershipPlan').findById(plan.id); assert.ok(existing); assert.equal(existing.status, 'inactive');
});

async function fixtureMember(name) {
  const user = await User.create({ email: `${name}@fixture.test`, password: 'fixture-password', role: 'member' });
  const member = await MemberProfile.create({ user: user._id, memberId: name, fullName: name, dateOfBirth: new Date('1995-01-01'), gender: 'other',
    mobileNumber: '9000000031', emergencyContactName: 'Fixture', emergencyContactPhone: '9000000032', height: 170, weight: 70, fitnessGoal: 'general_fitness', registrationStatus: 'active', membershipStatus: 'active' });
  const membership = await MemberMembership.create({ member: member._id, membershipPlan: plan._id, startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86400000), totalAmount: 999, amountPaid: 999, pendingAmount: 0, status: 'active', paymentStatus: 'paid' });
  return { member, membership };
}
test('atomic slot allocation does not overbook the last place', async () => {
  const target = await GymTimeSlot.findOneAndUpdate({ dayOfWeek: 'tuesday', name: 'Morning Regular' }, { $set: { maxCapacity: 1, currentCapacity: 0 } }, { returnDocument: 'after' });
  const first = await fixtureMember('CAPACITY-A'); const second = await fixtureMember('CAPACITY-B');
  const attempts = await Promise.all([first, second].map(item => request('POST', '/time-slots/allocate', { memberId: item.member.id, membershipId: item.membership.id, slotId: target.id }, authHeaders('admin'))));
  assert.deepEqual(attempts.map(item => item.status).sort(), [201, 409]);
  assert.equal((await GymTimeSlot.findById(target.id)).currentCapacity, 1);
  assert.equal(await MemberSlotAllocation.countDocuments({ timeSlot: target.id, status: 'active' }), 1);
});
test('lifecycle expiry releases a slot once and preserves financial history', async () => {
  const allocation = await MemberSlotAllocation.findOne({ status: 'active', timeSlot: (await GymTimeSlot.findOne({ dayOfWeek: 'tuesday', name: 'Morning Regular' }))._id });
  await MemberMembership.updateOne({ _id: allocation.membership }, { $set: { endDate: new Date(Date.now() - 1000) } });
  await MemberSlotAllocation.updateOne({ _id: allocation._id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  const reconcile = require('../services/lifecycleService').reconcile;
  await reconcile(); await reconcile();
  assert.equal((await GymTimeSlot.findById(allocation.timeSlot)).currentCapacity, 0);
  assert.equal((await MemberSlotAllocation.findById(allocation._id)).status, 'expired');
  assert.equal((await MemberMembership.findById(allocation.membership)).status, 'expired');
});
test('reminder notifications use unique deduplication keys', async () => {
  const user = await User.findOne({ role: 'member' });
  const create = require('../services/notificationService').createNotification;
  await create(user._id, 'payment_due', 'Due', 'Reminder', {}, 'same-reminder-key');
  await create(user._id, 'payment_due', 'Due', 'Reminder', {}, 'same-reminder-key');
  assert.equal(await Notification.countDocuments({ deduplicationKey: 'same-reminder-key' }), 1);
});

test('Razorpay refunds are provider-confirmed, idempotent and adjust membership balance once', async () => {
  const payment = await Payment.findOne({ membership: registered._id, paymentStatus: 'completed' });
  const first = await request('POST', `/payments/${payment.id}/refund`, { reason: 'Member requested a full refund' }, authHeaders('admin'));
  assert.equal(first.status, 200, JSON.stringify(first));
  const replay = await request('POST', `/payments/${payment.id}/refund`, { reason: 'Member requested a full refund' }, authHeaders('admin'));
  assert.equal(replay.status, 200, JSON.stringify(replay));
  const updated = await Payment.findById(payment.id); assert.equal(updated.paymentStatus, 'refunded'); assert.equal(updated.refunds.length, 1);
  assert.equal((await MemberMembership.findById(registered._id)).pendingAmount, payment.amount);
  assert.equal(refunds.size, 1);
});
test('member health consent and deferred integration settings are enforced on the server', async () => {
  const result = await request('POST', '/settings', { key: 'biometric_required', category: 'biometric', value: true }, authHeaders('admin'));
  assert.equal(result.status, 400);
  const invalid = await request('POST', '/settings', { key: 'enforce_slot_timing', category: 'attendance', value: 'false' }, authHeaders('admin'));
  assert.equal(invalid.status, 400);
});
