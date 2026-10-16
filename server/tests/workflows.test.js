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
process.env.STRIPE_SECRET_KEY = 'sk_test_isolated';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_isolated';
const Stripe = require('stripe');
const actualStripe = new Stripe('sk_test_isolated');
const sessions = new Map();
let checkoutCounter = 0;
const refunds = new Map();
const fakeStripe = { refunds: {
  create: async (data, options) => {
    if (refunds.has(options.idempotencyKey)) return refunds.get(options.idempotencyKey);
    const checkout = [...sessions.values()].find(session => session.payment_intent === data.payment_intent);
    const refund = { id: 're_' + refunds.size, payment_intent: data.payment_intent, amount: checkout.amount_total, currency: 'inr', status: 'succeeded' };
    refunds.set(options.idempotencyKey, refund); return refund;
  },
  retrieve: async id => [...refunds.values()].find(refund => refund.id === id),
}, webhooks: actualStripe.webhooks, checkout: { sessions: {
  create: async (data, options) => {
    const existing = [...sessions.values()].find(session => session.idempotencyKey === options.idempotencyKey);
    if (existing) return existing;
    const id = `cs_test_${++checkoutCounter}`;
    const session = { id, url: `https://checkout.stripe.com/${id}`, status: 'open', payment_status: 'unpaid',
      currency: 'inr', amount_total: data.line_items[0].price_data.unit_amount, metadata: data.metadata,
      payment_intent: `pi_test_${checkoutCounter}`, idempotencyKey: options.idempotencyKey };
    sessions.set(id, session); return session;
  },
  retrieve: async id => { const session = sessions.get(id); if (!session) throw new Error('Unknown test session'); return session; },
  expire: async id => { sessions.get(id).status = 'expired'; },
} } };
require.cache[require.resolve('stripe')].exports = () => fakeStripe;
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
async function webhook(session, id = crypto.randomUUID()) {
  const payload = JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { id: session.id } } });
  const signature = actualStripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const response = await fetch(base + '/payments/stripe/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload });
  return response.status;
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
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop(); });

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
test('Stripe checkout takes its amount from the server; return URL does not activate membership', async () => {
  const checkout = await request('POST', '/registration/checkout', { amount: 1 }, registrationHeaders);
  assert.equal(checkout.status, 200, JSON.stringify(checkout));
  const session = [...sessions.values()][0]; assert.equal(session.amount_total, plan.price * 100);
  assert.equal((await MemberMembership.findById(registered._id)).status, 'pending');
  const second = await request('POST', '/registration/checkout', {}, registrationHeaders);
  assert.equal(second.data.url, checkout.data.url);
});
test('unsigned or altered webhook payloads are rejected', async () => {
  const result = await request('POST', '/payments/stripe/webhook', { type: 'checkout.session.completed' }); assert.equal(result.status, 400);
  assert.equal((await MemberMembership.findById(registered._id)).status, 'pending');
});
test('paid Stripe webhook activates membership once, allocates slot/trainer, records receipt and notification', async () => {
  const checkout = [...sessions.values()][0]; checkout.payment_status = 'paid'; checkout.status = 'complete';
  assert.equal(await webhook(checkout), 200);
  assert.equal(await webhook(checkout), 200);
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

test('Stripe refunds are provider-confirmed, idempotent and adjust membership balance once', async () => {
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
