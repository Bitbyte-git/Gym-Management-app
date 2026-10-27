const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { chromium } = require('@playwright/test');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
(async () => {
  let db, server, vite, browser;
  const originalRequest = https.request;
  try {
    process.env.NODE_ENV = 'development'; process.env.JWT_SECRET = 'local-search-browser-test-only';
    process.env.JWT_REFRESH_SECRET = 'local-search-browser-refresh-only'; process.env.BIOMETRIC_IDENTIFICATION_MODE = 'morfin-local-development';
    process.env.BIOMETRIC_ENCRYPTION_KEYS = JSON.stringify({ synthetic: crypto.randomBytes(32).toString('base64') });
    process.env.BIOMETRIC_KEY_VERSION = 'synthetic';
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
    await mongoose.connect(db.getUri());
    const User = require('../models/User'), Member = require('../models/MemberProfile'), Enrollment = require('../models/BiometricEnrollment');
    const Attendance = require('../models/MemberAttendance'), { encrypt } = require('../services/biometricCrypto');
    const operator = await User.create({ email: 'reception@local-browser.test', password: 'synthetic-password', role: 'reception' });
    const members = [];
    for (const index of [0, 1]) {
      const m = await Member.create({ user: new mongoose.Types.ObjectId(), memberId: 'SYN-BROWSER-' + index,
        fullName: index === 0 ? 'Synthetic Alpha' : 'Synthetic Beta', dateOfBirth: new Date('1990-01-01'), gender: 'other',
        mobileNumber: '9000000000', emergencyContactName: 'Synthetic', emergencyContactPhone: '9000000001',
        height: 170, weight: 70, fitnessGoal: 'general_fitness', registrationStatus: 'active', membershipStatus: 'active' });
      const reference = 'synthetic-browser-enrollment-' + index, bytes = Buffer.from('FMR\0synthetic-gallery-' + index);
      await Enrollment.create({ member: m.id, enrollmentReference: reference, schemaVersion: 2, templateFormat: 'FMR_V2005',
        encryptedTemplate: encrypt(bytes, m.id + ':' + reference + ':template'), deviceId: 'SYNTHETIC', enrollmentStatus: 'enrolled' });
      bytes.fill(0);
      await require('../models/MemberMembership').create({ member: m.id, membershipPlan: new mongoose.Types.ObjectId(), totalAmount: 100,
        startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000), status: 'active', paymentStatus: 'paid' });
      members.push(m);
    }
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) await require('../models/GymOperatingHours').create({ dayOfWeek: day, isOpen: true, openTime: '00:00', closeTime: '23:59' });
    await require('../models/SystemSetting').create({ key: 'enforce_slot_timing', category: 'attendance', value: false });
    let sdkVerifications = 0;
    // Explicit SDK test doubles: no real capture, match or production attendance is claimed.
    https.request = (url, options, callback) => {
      assert.equal(url.pathname, '/morfinauth/verify');
      const req = new EventEmitter(); req.destroy = () => {};
      req.end = body => setImmediate(() => {
        const payload = JSON.parse(body);
        assert.equal(payload.TmpFormat, 0); assert.ok(payload.ProbTemplate); assert.ok(payload.GalleryTemplate);
        const response = new EventEmitter(); response.statusCode = 200; callback(response);
        response.emit('data', Buffer.from(JSON.stringify({ ErrorCode: 0, Status: ++sdkVerifications % 2 === 1 }))); response.emit('end');
      }); return req;
    };
    const { app } = require('../index');
    for (const model of Object.values(mongoose.models)) await model.init();
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    process.env.VITE_API_URL = 'http://127.0.0.1:' + server.address().port + '/api';
    const { createServer } = await import('vite');
    vite = await createServer({ root: 'client', server: { host: '127.0.0.1', port: 0 } }); await vite.listen();
    const origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(value => localStorage.setItem('accessToken', value), jwt.sign({ id: operator.id }, process.env.JWT_SECRET));
    const deviceCalls = [], browserErrors = [];
    await context.route('https://localhost:8030/morfinauth/**', async route => {
      const method = route.request().url().split('/').pop(); deviceCalls.push(method);
      assert.notEqual(method, 'verify'); assert.notEqual(method, 'getimage');
      const data = { ErrorCode: 0, ErrorDescription: 'Synthetic SDK response' };
      if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Device :MFS500';
      if (method === 'info') data.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC-ONLY' };
      if (method === 'capture') { data.Quality = 70; data.Nfiq = 2; }
      if (method === 'gettemplate') data.TmpData = Buffer.from('FMR\0synthetic-probe').toString('base64');
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const page = await context.newPage(); page.on('pageerror', error => browserErrors.push(error.message));
    await page.goto(origin + '/reception/attendance');
    await page.getByText('CHECKED IN', { exact: true }).waitFor();
    await page.locator('.kiosk-result').getByRole('heading', { name: 'Synthetic Alpha', exact: true }).waitFor();
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/local-template-search-synthetic.png', fullPage: true, animations: 'disabled' });
    await page.getByText('ATTENDANCE ALREADY RECORDED', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await Attendance.countDocuments({ member: members[0].id, sessionOpen: true }), 1);
    assert.equal(await Attendance.countDocuments({ member: members[1].id }), 0);
    assert.equal((await Enrollment.findOne({ member: members[0].id })).verificationCount, 1);
    const captures = deviceCalls.map((method, index) => method === 'capture' ? index : -1).filter(index => index >= 0);
    assert.ok(captures.length >= 2);
    const between = deviceCalls.slice(captures[0] + 1, captures[1]);
    assert.ok(between.includes('uninitdevice'));
    assert.ok(between.includes('info'));
    assert.ok(between.indexOf('uninitdevice') < between.indexOf('info'));
    assert.ok(sdkVerifications >= 4); assert.equal(deviceCalls.includes('getimage'), false); assert.deepEqual(browserErrors, []);
    console.log('Local template-search browser flow passed: automatic capture, server-owned SDK search across encrypted enrollments, sole member check-in, repeat scan ignored and no image retrieval. SDK responses were synthetic, not real hardware matching.');
  } finally {
    https.request = originalRequest;
    if (browser) await browser.close(); if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (db) await db.stop();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
