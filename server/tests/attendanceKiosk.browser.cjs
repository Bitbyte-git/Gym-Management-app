const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
(async () => {
  let db, server, vite, browser;
  try {
    process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'attendance-ui-tests-only'; process.env.JWT_REFRESH_SECRET = 'attendance-ui-refresh-tests-only';
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
    await mongoose.connect(db.getUri());
    const User = require('../models/User');
    const receptionist = await User.create({ email: 'reception@kiosk.test', password: 'synthetic-ui-password', role: 'reception' });
    const token = jwt.sign({ id: receptionist.id }, process.env.JWT_SECRET);
    const { app } = require('../index');
    for (const model of Object.values(mongoose.models)) await model.init();
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    process.env.VITE_API_URL = 'http://127.0.0.1:' + server.address().port + '/api';
    const { createServer } = await import('vite');
    vite = await createServer({ root: 'client', server: { host: '127.0.0.1', port: 0 } }); await vite.listen();
    const origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(value => localStorage.setItem('accessToken', value), token);
    const calls = [], errors = [];
    // Only local discovery/initialization is mocked. No capture or match success is fabricated.
    await context.route('https://localhost:8030/morfinauth/**', async route => {
      const method = route.request().url().split('/').pop(); calls.push(method);
      const data = { ErrorCode: 0, ErrorDescription: 'OK' };
      if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Devices: MFS500';
      if (method === 'info') data.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC-UI-ONLY' };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/reception/attendance');
    await page.getByRole('heading', { name: 'Automatic attendance unavailable', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Check in member', exact: true }).waitFor();
    assert.ok(calls.includes('info')); assert.equal(calls.includes('capture'), false);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('heading', { name: 'Scanning paused', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('heading', { name: 'Automatic attendance unavailable', exact: true }).waitFor();
    const holder = await context.newPage(); await holder.goto(origin);
    await holder.evaluate(() => { window.holdingScanner = navigator.locks.request('pulsefit-morfinauth', () => new Promise(resolve => { window.releaseScanner = resolve; })); });
    await holder.waitForFunction(() => typeof window.releaseScanner === 'function');
    await page.bringToFront();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('heading', { name: 'Scanner in use in another tab', exact: true }).waitFor();
    await holder.evaluate(() => window.releaseScanner());
    await holder.evaluate(() => window.holdingScanner);
    await page.getByRole('button', { name: 'Retry scanner', exact: true }).click();
    await page.getByRole('heading', { name: 'Automatic attendance unavailable', exact: true }).waitFor();
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/attendance-kiosk-desktop.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/attendance-kiosk-mobile.png', fullPage: true, animations: 'disabled' });
    assert.equal(calls.includes('capture'), false);
    assert.deepEqual(errors, []);
    console.log('Attendance UI browser acceptance passed: unavailable identifier, manual fallback, pause/resume, real cross-tab Web Lock, retry recovery and desktop/mobile rendering. Scanner I/O was mocked; no hardware acceptance claimed.');
  } finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (db) await db.stop();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
