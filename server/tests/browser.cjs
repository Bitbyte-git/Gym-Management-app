const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { execFileSync } = require('node:child_process');
(async () => {
  let database, server, vite, browser;
  const errors = [];
  try {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.0.12' } });
    process.env.NODE_ENV = 'test'; process.env.MONGODB_URI = database.getUri('pulsefit_browser_tests');
    process.env.JWT_SECRET = 'browser-tests-access-key'; process.env.JWT_REFRESH_SECRET = 'browser-tests-refresh-key';
    process.env.PAYMENT_GATEWAY_ENABLED = 'false';
    execFileSync(process.execPath, ['server/seed.js'], { env: process.env, stdio: 'pipe' });
    await mongoose.connect(process.env.MONGODB_URI);
    const { app } = require('../index');
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    process.env.VITE_API_URL = `http://127.0.0.1:${server.address().port}/api`;
    const { createServer } = await import('vite');
    vite = await createServer({ root: 'client', server: { host: '127.0.0.1', port: 0 } }); await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    // Exact local origin for this isolated browser test only.
    require('../config/env').cors.origin.push(origin);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    fs.mkdirSync('test-results', { recursive: true });
    for (const role of ['admin', 'reception', 'trainer', 'member']) {
      await page.goto(`${origin}/login`);
      await page.getByLabel('Workspace role').selectOption(role);
      await page.getByLabel('Email address').fill(`${role}@pulsefit.com`);
      await page.locator('input[type=password]').fill(`${role}123`);
      await page.getByRole('button', { name: 'Sign in securely' }).click();
      await page.waitForURL(`**/${['admin', 'reception'].includes(role) ? 'admin' : role}/dashboard`);
      await page.locator('.dash-content .stats, .member-hero').first().waitFor();
      if (role === 'admin') {
        await page.getByRole('button', { name: 'Plans', exact: true }).click();
        await page.getByRole('cell', { name: 'Basic', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.getByLabel('Plan name').fill('Browser Test Plan');
        await page.getByLabel('Description', { exact: true }).fill('Browser workflow');
        await page.getByLabel('Duration in months').fill('2');
        await page.getByLabel('Price (INR)').fill('1200');
        await page.getByLabel('Included services').fill('Gym access, Locker');
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByRole('cell', { name: 'Browser Test Plan', exact: true }).waitFor();
        await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
      }
      if (role === 'reception') assert.equal(await page.locator('.side nav').getByRole('button', { name: 'Settings', exact: true }).count(), 0);
      if (role === 'trainer') { await page.getByRole('button', { name: 'My availability', exact: true }).click(); await page.getByRole('cell', { name: 'monday', exact: true }).waitFor(); }
      if (role === 'member') {
        await page.getByRole('button', { name: 'My profile', exact: true }).click();
        await page.getByRole('cell', { name: 'Demo Member', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        await page.getByLabel('Address', { exact: true }).fill('Browser tested address');
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await page.getByText('Saved successfully.', { exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.waitForURL('**/login');
      console.log(`Browser role passed: ${role}`);
    }
    await page.goto(`${origin}/register`);
    await page.getByLabel('First Name').fill('Browser'); await page.getByLabel('Last Name').fill('Registrant');
    await page.getByLabel('Email', { exact: false }).fill('browser-new@example.com');
    await page.getByLabel('Mobile Number').fill('9000000021'); await page.getByLabel('Date of Birth').fill('1998-01-05');
    await page.getByLabel('Gender').selectOption('other'); await page.getByLabel('Emergency Contact Name').fill('Contact');
    await page.getByLabel('Emergency Contact Phone').fill('9000000022');
    await page.getByLabel('Password', { exact: false }).first().fill('browser-password-123');
    await page.getByLabel('Confirm Password').fill('browser-password-123');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('I consent').check(); await page.getByLabel('Height').fill('170'); await page.getByRole('spinbutton', { name: 'Weight (kg) *', exact: true }).fill('70');
    await page.getByLabel('Fitness Goal').selectOption('general_fitness'); await page.getByLabel('Exercise Experience').selectOption('beginner');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('heading', { name: 'Basic', exact: true }).click();
    await page.locator('.slot-card').filter({ hasText: 'monday' }).first().click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Complete Registration' }).click();
    await page.getByRole('heading', { name: /Registration saved/ }).waitFor();
    await page.reload(); await page.getByRole('heading', { name: /Registration saved/ }).waitFor();
    await page.getByRole('button', { name: 'Pay with Razorpay' }).click();
    await page.getByText(/Razorpay is not configured/).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/registration-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Browser registration, persistence, unavailable-payment handling, and mobile smoke checks passed');
  } finally {
    if (browser) await browser.close(); if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (database) await database.stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
