const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-biometric-test-secret';
process.env.JWT_REFRESH_SECRET = 'isolated-biometric-refresh-secret';
process.env.BIOMETRIC_ENCRYPTION_KEYS = JSON.stringify({ v1: crypto.randomBytes(32).toString('base64') });
const config = require('../config/env');
const encryption = require('../services/biometricCrypto');
const { validateCapture, decodeBase64 } = require('../services/biometricValidation');
const Enrollment = require('../models/BiometricEnrollment');
const Member = require('../models/MemberProfile');
const User = require('../models/User');
const Attendance = require('../models/MemberAttendance');
const service = require('../services/biometricService');
const jwt = require('jsonwebtoken');
// Synthetic protocol-shaped data only; these bytes cannot identify a person.
const fixture = () => ({
  templateBase64: Buffer.from('FMR\0synthetic-test-only').toString('base64'), templateFormat: 'FMR_V2005',
  imageBase64: Buffer.concat([Buffer.from('BM'), Buffer.alloc(30)]).toString('base64'), imageFormat: 'BMP',
  quality: 70, nfiq: 2, deviceModel: 'MFS500', deviceSerial: 'SYNTHETIC-ONLY',
  imageWidth: 296, imageHeight: 354, vendorErrorCode: 0, capturedAt: new Date().toISOString(),
});
test('AES-GCM uses fresh nonces, decrypts and detects tamper/context changes', () => {
  const bytes = Buffer.from('synthetic'), a = encryption.encrypt(bytes, 'member:template'), b = encryption.encrypt(bytes, 'member:template');
  assert.notEqual(a.nonce, b.nonce); assert.deepEqual(encryption.decrypt(a, 'member:template'), bytes);
  assert.throws(() => encryption.decrypt(a, 'other-member:template'));
  assert.throws(() => encryption.decrypt({ ...a, tag: Buffer.alloc(16).toString('base64') }, 'member:template'));
});
test('strict capture validation rejects malformed, oversized and unsuccessful captures', () => {
  assert.ok(validateCapture(fixture(), 'right_index').template);
  for (const capture of [null, {}, { ...fixture(), templateBase64: '!!!=' }, { ...fixture(), templateBase64: 'A'.repeat(90000) }, { ...fixture(), quality: 40 }, { ...fixture(), vendorErrorCode: 5 }, { ...fixture(), deviceSerial: '' }, { ...fixture(), templateFormat: 'unknown' }, { ...fixture(), imageBase64: 'eHl6' }]) {
    assert.throws(() => validateCapture(capture, 'right_index'));
  }
  assert.throws(() => decodeBase64('YR==', 100, 'Noncanonical'));
  assert.throws(() => validateCapture(fixture(), 'invented_finger'));
});
test('serialization excludes legacy data and encrypted envelopes even when selected', () => {
  const e = new Enrollment({ enrollmentData: { secret: 'legacy' }, encryptedTemplate: encryption.encrypt(Buffer.from('synthetic'), 'x') });
  for (const value of [e.toJSON(), e.toObject()]) { assert.equal(value.enrollmentData, undefined); assert.equal(value.encryptedTemplate, undefined); }
});
let db, server, base, member, other, tokens = {};
async function request(method, path, body, role = 'admin') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
  await mongoose.connect(db.getUri());
  for (const role of ['admin', 'member', 'reception', 'trainer']) {
    const user = await User.create({ email: role + '@biometric.test', password: 'synthetic-password-123', role });
    tokens[role] = jwt.sign({ id: user.id }, config.jwt.secret);
    if (role === 'member') member = await Member.create({ user: user._id, memberId: 'SYN001', fullName: 'Synthetic Member', dateOfBirth: new Date('1990-01-01'), gender: 'other', mobileNumber: '9000000000', emergencyContactName: 'Synthetic', emergencyContactPhone: '9000000002', height: 170, weight: 70, fitnessGoal: 'general_fitness' });
  }
  const otherUser = await User.create({ email: 'other@biometric.test', password: 'synthetic-password-123', role: 'member' });
  other = await Member.create({ user: otherUser._id, memberId: 'SYN002', fullName: 'Other Synthetic', dateOfBirth: new Date('1990-01-01'), gender: 'other', mobileNumber: '9000000001', emergencyContactName: 'Synthetic', emergencyContactPhone: '9000000002', height: 170, weight: 70, fitnessGoal: 'general_fitness' });
  const { app } = require('../index');
  for (const model of Object.values(mongoose.models)) await model.init();
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = 'http://127.0.0.1:' + server.address().port + '/api';
}, { timeout: 240000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (db) await db.stop(); });
test('enrollment authorization, encryption, replacement and deletion lifecycle', async () => {
  const body = { memberId: String(member._id), fingerPosition: 'right_index', captureData: fixture() };
  assert.equal((await request('POST', '/biometrics/enroll/process', body, null)).status, 401);
  assert.equal((await request('POST', '/biometrics/enroll/process', body, 'trainer')).status, 403);
  assert.equal((await request('POST', '/biometrics/enroll/process', { ...body, memberId: String(other._id) }, 'member')).status, 403);
  assert.equal((await request('POST', '/biometrics/enroll/process', { ...body, captureData: {} })).status, 400);
  assert.equal((await request('POST', '/biometrics/enroll/process', { ...body, captureData: { ...fixture(), imageBase64: 'A'.repeat(900000) } })).status, 413);
  const created = await request('POST', '/biometrics/enroll/process', body, 'reception');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.encryptedTemplate, undefined);
  let stored = await Enrollment.findOne({ member: member._id }).select('+encryptedTemplate +encryptedImage');
  assert.ok(stored.encryptedTemplate); assert.equal(stored.encryptedImage, undefined);
  assert.deepEqual(encryption.decrypt(stored.encryptedTemplate, member.id + ':' + stored.enrollmentReference + ':template'), Buffer.from(body.captureData.templateBase64, 'base64'));
  assert.equal((await request('POST', '/biometrics/enroll/process', body)).status, 409);
  config.biometric.retainImages = true;
  const replaced = await request('POST', '/biometrics/enroll/process', { ...body, replaceEnrollmentReference: stored.enrollmentReference });
  assert.equal(replaced.status, 201);
  assert.equal((await request('POST', '/biometrics/enroll/process', { ...body, replaceEnrollmentReference: stored.enrollmentReference })).status, 409);
  stored = await Enrollment.findOne({ member: member._id }).select('+encryptedImage');
  assert.ok(stored.encryptedImage);
  await service.getMemberByEnrollment(stored.enrollmentReference);
  assert.equal((await Enrollment.findById(stored._id)).verificationCount, 0);
  assert.equal((await request('GET', '/biometrics/enrollments')).body.data[0].encryptedImage, undefined);
  assert.equal((await request('DELETE', '/biometrics/enrollment', { memberId: member.id }, 'reception')).status, 403);
  assert.equal((await request('DELETE', '/biometrics/enrollment', { memberId: other.id }, 'member')).status, 403);
  assert.equal((await request('DELETE', '/biometrics/enrollment', { memberId: member.id }, 'member')).status, 200);
  assert.equal(await Enrollment.countDocuments({ member: member._id }), 0);
  config.biometric.retainImages = false;
});
test('concurrent enrollment saves cannot silently overwrite; unavailable matcher never records attendance', async () => {
  const body = { memberId: member.id, fingerPosition: 'right_index', captureData: fixture() };
  const saves = await Promise.all([request('POST', '/biometrics/enroll/process', body), request('POST', '/biometrics/enroll/process', body)]);
  assert.deepEqual(saves.map(r => r.status).sort(), [201, 409]);
  const before = await Attendance.countDocuments();
  for (const path of ['/attendance/checkin', '/attendance/checkout', '/biometrics/verify']) {
    const result = await request('POST', path, { ...body, matched: true, score: 100, verificationSession: 'forged' });
    assert.equal(result.status, 503); assert.equal(result.body.code, 'MATCHER_UNAVAILABLE');
  }
  assert.equal(await Attendance.countDocuments(), before);
  const keys = config.biometric.keys; config.biometric.keys = {};
  assert.equal((await request('POST', '/biometrics/enroll/initialize', { memberId: member.id })).status, 503);
  config.biometric.keys = keys;
});
test('browser adapter follows installed SDK sequence and rejects vendor errors, disconnects and overlap', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  let calls = [];
  const capture = fixture();
  const fetchImpl = async (url, options) => {
    const method = url.split('/').pop(); calls.push({ method, body: options.body && JSON.parse(options.body) });
    const data = { ErrorCode: 0, ErrorDescription: 'OK' };
    if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Devices: MFS500';
    if (method === 'info') data.DeviceInfo = { SerialNo: 'SYNTHETIC-ONLY', Model: 'MFS500', Width: 296, Height: 354 };
    if (method === 'capture') Object.assign(data, { Quality: 70, Nfiq: 2 });
    if (method === 'gettemplate') data.ImgData = capture.templateBase64;
    if (method === 'getimage') data.ImgData = capture.imageBase64;
    return new Response(JSON.stringify(data));
  };
  const adapter = createMorFinAuth({ fetchImpl });
  const pending = adapter.capture();
  await assert.rejects(adapter.capture(), /already in progress/);
  const result = await pending;
  assert.equal(result.templateFormat, 'FMR_V2005');
  assert.deepEqual(calls.map(c => c.method), ['connecteddevicelist', 'checkdevice', 'info', 'capture', 'gettemplate', 'getimage', 'uninitdevice']);
  assert.deepEqual(calls.find(c => c.method === 'capture').body, { Quality: 60, TimeOut: 10 });
  const failed = createMorFinAuth({ fetchImpl: async () => new Response(JSON.stringify({ ErrorCode: 12, ErrorDescription: 'Synthetic license failure' })) });
  await assert.rejects(failed.capture(), /12: Synthetic license failure/);
  const disconnected = createMorFinAuth({ fetchImpl: async () => new Response(JSON.stringify({ ErrorCode: 0, ErrorDescription: 'Connected Devices: ' })) });
  await assert.rejects(disconnected.capture(), /disconnected/);
  const offline = createMorFinAuth({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.capture(), /certificate/);
  const cancelled = new AbortController(); cancelled.abort();
  const aborting = createMorFinAuth({ fetchImpl: async (url, options) => { if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError'); } });
  await assert.rejects(aborting.capture({ signal: cancelled.signal }), /cancelled/);
});

test('documented local verify and match diagnostics require operation success and boolean Status', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  let status = true, code = 0, calls = [];
  const adapter = createMorFinAuth({ fetchImpl: async (url, options) => {
    const method = url.split('/').pop(); calls.push({ method, body: options.body && JSON.parse(options.body) });
    let response = { ErrorCode: 0, ErrorDescription: 'OK' };
    if (method === 'connecteddevicelist') response.ErrorDescription = 'Connected Devices: MFS500';
    if (method === 'info') response.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC-ONLY' };
    if (method === 'verify' || method === 'match') response = { ErrorCode: code, ErrorDescription: 'Synthetic test response', Status: status };
    return new Response(JSON.stringify(response));
  } });
  const template = fixture().templateBase64;
  const args = { probeTemplate: template, galleryTemplate: template };
  assert.deepEqual(await adapter.verify(args), { matched: true, vendorErrorCode: 0, diagnosticOnly: true });
  assert.deepEqual(calls.find(c => c.method === 'verify').body, { ProbTemplate: template, GalleryTemplate: template, TmpFormat: 0 });
  status = false;
  assert.equal((await adapter.match(args)).matched, false);
  assert.deepEqual(calls.find(c => c.method === 'match').body, { Quality: 60, TimeOut: 10, GalleryTemplate: template, TmpFormat: 0 });
  status = 'true';
  await assert.rejects(adapter.verify(args), /undocumented matching status/);
  status = true; code = -2018;
  await assert.rejects(adapter.match(args), /client license key/);
  assert.equal(calls.at(-1).method, 'uninitdevice');
});
test('template response supports PDF TmpData and sample ImgData, rejecting ambiguity', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  let ambiguous = false;
  const f = fixture();
  const adapter = createMorFinAuth({ fetchImpl: async url => {
    const method = url.split('/').pop();
    const data = { ErrorCode: '0', ErrorDescription: 'OK' };
    if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Devices: MFS500';
    if (method === 'info') data.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC-ONLY' };
    if (method === 'capture') data.Quality = 70;
    if (method === 'gettemplate') { data.TmpData = f.templateBase64; if (ambiguous) data.ImgData = 'eHl6'; }
    if (method === 'getimage') data.ImgData = f.imageBase64;
    return new Response(JSON.stringify(data));
  } });
  assert.equal((await adapter.capture()).templateBase64, f.templateBase64);
  ambiguous = true;
  await assert.rejects(adapter.capture(), /Ambiguous template/);
});
