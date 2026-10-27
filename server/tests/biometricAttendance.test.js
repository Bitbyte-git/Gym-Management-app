const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-attendance-tests-only';
process.env.JWT_REFRESH_SECRET = 'isolated-attendance-refresh-only';
const config = require('../config/env'), service = require('../services/biometricAttendanceService'), engine = require('../services/identificationEngine');
const Member = require('../models/MemberProfile'), User = require('../models/User'), Enrollment = require('../models/BiometricEnrollment');
const Attendance = require('../models/MemberAttendance'), Verification = require('../models/BiometricVerificationSession');
let db, server, base, operator, token, number = 0, selected, outcome = 'identified';
const realAvailable = engine.available, realIdentify = engine.identify;
// Test-only backend matcher double: no fingerprint comparison or production implementation.
async function fixture() {
  const member = await Member.create({ user: new mongoose.Types.ObjectId(), memberId: 'SYN-ATT-' + ++number,
    fullName: 'Synthetic Member', dateOfBirth: new Date('1990-01-01'), gender: 'other', mobileNumber: '9000000000',
    emergencyContactName: 'Synthetic', emergencyContactPhone: '9000000001', height: 170, weight: 70,
    fitnessGoal: 'general_fitness', registrationStatus: 'active', membershipStatus: 'active' });
  const enrollment = await Enrollment.create({ member: member.id, enrollmentReference: 'synthetic-' + number,
    deviceId: 'SYNTHETIC', schemaVersion: 2, enrollmentStatus: 'enrolled', isActive: true });
  const membership = await require('../models/MemberMembership').create({ member: member.id, membershipPlan: new mongoose.Types.ObjectId(),
    startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000), totalAmount: 100, paymentStatus: 'paid', status: 'active' });
  selected = { member, enrollment, membership }; outcome = 'identified';
  engine.available = () => true;
  engine.identify = async input => ({ outcome, memberId: selected.member.id, enrollmentReference: selected.enrollment.enrollmentReference,
    challenge: input.challenge, eventId: input.eventId, stationContext: input.stationContext });
  return selected;
}
before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } }); await mongoose.connect(db.getUri());
  operator = await User.create({ email: 'reception@attendance.test', password: 'synthetic-test-password', role: 'reception' });
  token = jwt.sign({ id: operator.id }, config.jwt.secret);
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) await require('../models/GymOperatingHours').create({ dayOfWeek: day, isOpen: true, openTime: '00:00', closeTime: '23:59' });
  await require('../models/SystemSetting').create({ key: 'enforce_slot_timing', value: false, category: 'attendance' });
  const { app } = require('../index'); for (const model of Object.values(mongoose.models)) await model.init();
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = 'http://127.0.0.1:' + server.address().port + '/api';
}, { timeout: 240000 });
after(async () => { engine.available = realAvailable; engine.identify = realIdentify; if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (db) await db.stop(); });
const probe = Buffer.from('FMR\0synthetic-attendance-only').toString('base64');
async function verified(station) {
  const v = await service.issueVerification(station.stationToken, operator.id);
  await service.identify({ stationToken: station.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' }, operator.id);
  return { stationToken: station.stationToken, verificationToken: v.verificationToken, eventId: v.eventId };
}
async function age(member, hours = .05) {
  const at = new Date(Date.now() - hours * 3600000);
  await Member.updateOne({ _id: member.id }, { $set: { lastBiometricPunchAt: at } });
  await Attendance.updateMany({ member: member.id }, { $set: { checkInTime: at } });
}
async function request(path, body, auth = token) {
  const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, ...await r.json() };
}
test('trusted test identity checks in, next eligible event closes exact visit, and network retries return original result', async () => {
  const { member } = await fixture(), station = await service.openStation(operator.id), v = await verified(station);
  const first = await service.record(v, operator.id); assert.equal(first.action, 'checkin'); assert.equal(first.recorded, true);
  assert.deepEqual(await service.record(v, operator.id), first); assert.equal(await Attendance.countDocuments({ member: member.id }), 1);
  await age(member); await service.confirmRemoval(station.stationToken, operator.id);
  const out = await service.record(await verified(station), operator.id);
  assert.equal(out.action, 'checkout'); assert.equal(out.attendanceId, first.attendanceId);
  const saved = await Attendance.findById(out.attendanceId);
  assert.equal(saved.sessionOpen, false); assert.equal(saved.checkOutVerificationReference, out.eventId);
});
test('cooldown across stations and held-finger latch after cooldown prevent accidental checkout', async () => {
  const { member } = await fixture(), station = await service.openStation(operator.id);
  await service.record(await verified(station), operator.id);
  const b = await service.openStation(operator.id), duplicate = await service.record(await verified(b), operator.id);
  assert.equal(duplicate.recorded, false); assert.equal(duplicate.code, 'DUPLICATE_SCAN'); assert.ok(duplicate.retryAfterSeconds > 0);
  await age(member);
  const held = await service.record(await verified(station), operator.id);
  assert.equal(held.recorded, false); assert.equal(held.requiresRemovalConfirmation, true);
  assert.equal(await Attendance.countDocuments({ member: member.id, sessionOpen: true }), 1);
});
test('simultaneous stations and identical event retries cannot create duplicate open sessions', async () => {
  const { member } = await fixture(), a = await service.openStation(operator.id), b = await service.openStation(operator.id);
  const va = await verified(a), vb = await verified(b);
  const results = await Promise.all([service.record(va, operator.id), service.record(vb, operator.id)]);
  assert.equal(results.filter(r => r.recorded).length, 1);
  assert.equal(await Attendance.countDocuments({ member: member.id, sessionOpen: true }), 1);
  const same = await Promise.all([service.record(va, operator.id), service.record(va, operator.id)]); assert.deepEqual(same[0], same[1]);
});
test('unknown and ambiguous identities record nothing', async () => {
  const { member, enrollment } = await fixture();
  for (outcome of ['unknown', 'ambiguous']) {
    const s = await service.openStation(operator.id), v = await service.issueVerification(s.stationToken, operator.id);
    await assert.rejects(service.identify({ stationToken: s.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' }, operator.id), e => ['UNKNOWN_FINGERPRINT', 'AMBIGUOUS_FINGERPRINT'].includes(e.code));
  }
  assert.equal(await Attendance.countDocuments({ member: member.id }), 0); assert.equal((await Enrollment.findById(enrollment.id)).verificationCount, 0);
});
test('suspension blocks entry but expired membership can still check out an overnight visit', async () => {
  const { member, membership } = await fixture(), s = await service.openStation(operator.id);
  await Member.updateOne({ _id: member.id }, { $set: { registrationStatus: 'suspended' } });
  await assert.rejects(service.record(await verified(s), operator.id), e => e.code === 'MEMBERSHIP_INELIGIBLE');
  const old = new Date(Date.now() - 8 * 3600000);
  const visit = await Attendance.create({ member: member.id, attendanceDate: old, checkInTime: old });
  await require('../models/MemberMembership').updateOne({ _id: membership.id }, { $set: { status: 'expired' } });
  const out = await service.record(await verified(s), operator.id); assert.equal(out.action, 'checkout'); assert.equal(out.attendanceId, visit.id);
});
test('stale review leaves visit open; configured checkout policy closes and flags it', async () => {
  const { member } = await fixture(), s = await service.openStation(operator.id), old = new Date(Date.now() - 20 * 3600000);
  const visit = await Attendance.create({ member: member.id, attendanceDate: old, checkInTime: old });
  const result = await service.record(await verified(s), operator.id); assert.equal(result.action, 'review'); assert.equal(result.recorded, false);
  assert.equal((await Attendance.findById(visit.id)).sessionOpen, true);
  assert.ok((await service.overview()).staleSessions.some(row => row.id === visit.id));
  config.biometric.stalePolicy = 'allow_checkout';
  try { const out = await service.record(await verified(s), operator.id); assert.equal(out.action, 'checkout'); assert.equal(out.staleSession, true); }
  finally { config.biometric.stalePolicy = 'review'; }
});
test('expired, cross-station and forged results fail; exact committed retries survive pause', async () => {
  await fixture(); const s = await service.openStation(operator.id), v = await verified(s);
  await Verification.updateOne({ eventId: v.eventId }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  await assert.rejects(service.record(v, operator.id), e => e.code === 'UNTRUSTED_VERIFICATION');
  const other = await service.openStation(operator.id);
  await assert.rejects(service.record({ ...v, stationToken: other.stationToken }, operator.id), e => e.code === 'INVALID_VERIFICATION');
  const fresh = await verified(s);
  await assert.rejects(service.record({ ...fresh, eventId: '00000000-0000-0000-0000-000000000000' }, operator.id), e => e.code === 'EVENT_MISMATCH');
  const result = await service.record(fresh, operator.id); await service.closeStation(s.stationToken, operator.id);
  assert.deepEqual(await service.record(fresh, operator.id), result);
  await assert.rejects(service.issueVerification(s.stationToken, operator.id), e => e.code === 'STATION_INACTIVE');
  assert.equal((await request('/attendance/biometric/record', { matched: true, memberId: selected.member.id, action: 'checkout' })).status, 400);
});
test('HTTP role checks and unavailable real identifier reject all browser match assertions', async () => {
  await fixture();
  assert.equal((await request('/attendance/biometric/stations', {}, null)).status, 401);
  const memberUser = await User.create({ email: 'member@attendance.test', password: 'synthetic-password', role: 'member' });
  assert.equal((await request('/attendance/biometric/stations', {}, jwt.sign({ id: memberUser.id }, config.jwt.secret))).status, 403);
  engine.available = realAvailable; engine.identify = realIdentify;
  const s = (await request('/attendance/biometric/stations', {})).data;
  const v = (await request('/attendance/biometric/challenges', { stationToken: s.stationToken })).data;
  const count = await Attendance.countDocuments();
  const r = await request('/attendance/biometric/identify', { stationToken: s.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' });
  assert.equal(r.status, 503); assert.equal(r.code, 'IDENTIFICATION_UNAVAILABLE');
  assert.equal((await request('/attendance/biometric/record', { stationToken: s.stationToken, verificationToken: v.verificationToken, eventId: v.eventId })).status, 403);
  assert.equal(await Attendance.countDocuments(), count);
});
test('logout cancels pending verification and blocks late writes', async () => {
  await fixture(); const s = await service.openStation(operator.id), v = await verified(s);
  assert.equal((await request('/auth/logout', {})).status, 200);
  await assert.rejects(service.record(v, operator.id), e => e.code === 'STATION_INACTIVE');
});

test('identification finishing after pause cannot authorize attendance', async () => {
  const f = await fixture(), s = await service.openStation(operator.id), v = await service.issueVerification(s.stationToken, operator.id);
  let release, reached; const begun = new Promise(resolve => { reached = resolve; });
  engine.identify = input => new Promise(resolve => { release = () => resolve({ outcome: 'identified', memberId: f.member.id, enrollmentReference: f.enrollment.enrollmentReference, challenge: input.challenge, eventId: input.eventId, stationContext: input.stationContext }); reached(); });
  const identification = service.identify({ stationToken: s.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' }, operator.id);
  await begun; await service.closeStation(s.stationToken, operator.id); release();
  await assert.rejects(identification, e => e.code === 'STATION_INACTIVE');
  assert.equal(await Attendance.countDocuments({ member: f.member.id }), 0);
});
test('provider results with a forged challenge and revoked operators cannot record', async () => {
  const f = await fixture(), s = await service.openStation(operator.id);
  const original = engine.identify;
  engine.identify = async input => ({ ...await original(input), challenge: 'wrong-challenge' });
  const v = await service.issueVerification(s.stationToken, operator.id);
  await assert.rejects(service.identify({ stationToken: s.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' }, operator.id), e => e.code === 'INVALID_ENGINE_RESULT');
  engine.identify = original;
  const valid = await verified(s);
  await User.updateOne({ _id: operator.id }, { $set: { isActive: false } });
  try { await assert.rejects(service.record(valid, operator.id), e => e.code === 'NOT_AUTHORIZED'); }
  finally { await User.updateOne({ _id: operator.id }, { $set: { isActive: true } }); }
  assert.equal(await Attendance.countDocuments({ member: f.member.id }), 0);
});

test('the real application provider searches encrypted Mongo templates through SDK transport and records the sole member', async () => {
  const https = require('node:https'), { EventEmitter } = require('node:events'), crypto = require('node:crypto');
  const { encrypt } = require('../services/biometricCrypto');
  const old = { nodeEnv: config.nodeEnv, biometric: { ...config.biometric }, request: https.request, available: engine.available, identify: engine.identify };
  await Enrollment.updateMany({}, { $set: { isActive: false } });
  const a = await fixture(), b = await fixture();
  config.nodeEnv = 'development';
  Object.assign(config.biometric, { identificationMode: 'morfin-local-development', keyVersion: 'synthetic', keys: { synthetic: crypto.randomBytes(32).toString('base64') } });
  const galleries = [a, b].map((f, index) => Buffer.from('FMR\0synthetic-gallery-' + index));
  const requests = [];
  try {
    for (const [index, f] of [a, b].entries()) await Enrollment.updateOne({ _id: f.enrollment.id }, { $set: {
      templateFormat: 'FMR_V2005', encryptedTemplate: encrypt(galleries[index], f.member.id + ':' + f.enrollment.enrollmentReference + ':template'),
    } });
    // Synthetic SDK transport only: statuses are fixtures, not algorithmic fingerprint comparisons.
    https.request = (url, options, callback) => {
      assert.equal(url.pathname, '/morfinauth/verify'); assert.equal(url.hostname, 'localhost');
      const req = new EventEmitter(); req.destroy = () => {};
      req.end = body => setImmediate(() => {
        requests.push(JSON.parse(body)); const res = new EventEmitter(); res.statusCode = 200;
        callback(res); res.emit('data', Buffer.from(JSON.stringify({ ErrorCode: 0, Status: requests.length === 1 }))); res.emit('end');
      });
      return req;
    };
    engine.available = realAvailable; engine.identify = realIdentify;
    assert.equal(engine.available(), true);
    const s = await service.openStation(operator.id), v = await service.issueVerification(s.stationToken, operator.id);
    const identified = await service.identify({ stationToken: s.stationToken, verificationToken: v.verificationToken, probeTemplate: probe, templateFormat: 'FMR_V2005' }, operator.id);
    assert.equal(identified.search.comparisons, 2); assert.equal(requests.length, 2);
    assert.equal(requests[0].GalleryTemplate, galleries[0].toString('base64')); assert.equal(requests[1].GalleryTemplate, galleries[1].toString('base64'));
    const recorded = await service.record({ stationToken: s.stationToken, verificationToken: v.verificationToken, eventId: v.eventId }, operator.id);
    assert.equal(recorded.member.id, a.member.id); assert.equal(recorded.action, 'checkin');
    assert.equal(await Attendance.countDocuments({ member: b.member.id }), 0);
    assert.equal(JSON.stringify(recorded).includes('GalleryTemplate'), false);
  } finally {
    galleries.forEach(bytes => bytes.fill(0));
    https.request = old.request; config.nodeEnv = old.nodeEnv; Object.assign(config.biometric, old.biometric);
    engine.available = old.available; engine.identify = old.identify;
  }
});
