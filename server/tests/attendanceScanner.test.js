const { test } = require('node:test');
const assert = require('node:assert/strict');
// Lifecycle doubles only. No real hardware capture, identification or attendance is simulated for users.
async function setup(overrides = {}) {
  const { createAttendanceScanner } = await import('../../client/src/services/attendanceScanner.mjs');
  const states = [], calls = [];
  const capture = { templateBase64: 'U1lOVEhFVElD', templateFormat: 'FMR_V2005' };
  const result = { recorded: true, action: 'checkin', eventId: 'synthetic', message: 'Synthetic test result' };
  const transport = {
    capabilities: async () => ({ identificationAvailable: true, rearmSeconds: 5 }),
    open: async () => ({ stationToken: 'synthetic-station' }),
    challenge: async () => ({ verificationToken: 'synthetic-verification', eventId: 'synthetic' }),
    close: async () => { calls.push('close'); },
    identify: async () => { calls.push('identify'); },
    record: async () => { calls.push('record'); return result; },
    rearm: async () => {}, ...overrides.transport,
  };
  const scanner = {
    runSession: async (options, task) => { calls.push('init'); try { return await task({ device: { model: 'SYNTHETIC' },
      captureTemplate: async () => { calls.push('capture'); return capture; }, reinitialize: async () => { calls.push('reinitialize'); }, ...overrides.handle }); } finally { calls.push('cleanup'); } },
    recover: async () => { calls.push('recover'); }, ...overrides.scanner,
  };
  const flow = createAttendanceScanner({ scanner, transport, wait: overrides.wait || (async () => {}),
    onState: state => { states.push(state); overrides.onState?.(state, flow); } });
  return { flow, states, calls, result };
}
test('missing identifier initializes scanner but never captures or records', async () => {
  const t = await setup({ transport: { capabilities: async () => ({ identificationAvailable: false, reason: 'Unavailable test provider' }) } });
  await t.flow.start(); assert.deepEqual(t.calls, ['init', 'cleanup']); assert.equal(t.states.at(-1).code, 'IDENTIFICATION_UNAVAILABLE');
});
test('finite no-finger timeouts rearm quietly and disconnection stops sequential capture', async () => {
  let active = 0, maximum = 0, attempts = 0, waits = 0;
  const t = await setup({ handle: { captureTemplate: async () => { active++; maximum = Math.max(maximum, active); await Promise.resolve(); active--;
    throw Object.assign(new Error('Synthetic error'), { code: ++attempts <= 2 ? 'CAPTURE_TIMEOUT' : 'DEVICE_DISCONNECTED' }); } }, wait: async () => { waits++; } });
  await t.flow.start(); assert.equal(maximum, 1); assert.equal(waits, 2); assert.equal(t.states.at(-1).phase, 'disconnected'); assert.equal(t.calls.includes('record'), false);
});
test('page navigation or visibility pause drains a late capture without identifying or recording', async () => {
  let release, reached; const captured = new Promise(resolve => { reached = resolve; });
  const t = await setup({ handle: { captureTemplate: () => new Promise(resolve => { release = resolve; reached(); }) } });
  const run = t.flow.start(); await captured;
  const stopped = t.flow.stop('Page hidden'); release({ templateBase64: 'U1lOVEhFVElD', templateFormat: 'FMR_V2005' });
  await stopped; await run; assert.equal(t.calls.includes('identify'), false); assert.equal(t.calls.includes('record'), false); assert.ok(t.calls.includes('cleanup'));
});
test('logout during identification prevents a late result from sending attendance', async () => {
  let release, reached; const identified = new Promise(resolve => { reached = resolve; });
  const t = await setup({ transport: { identify: () => new Promise(resolve => { release = resolve; reached(); }) } });
  const run = t.flow.start(); await identified; const stopped = t.flow.stop('Signing out'); release(); await stopped; await run;
  assert.equal(t.calls.includes('record'), false);
});
test('lost record response is retried with identical event; it never triggers another capture', async () => {
  let attempts = 0; const requests = [];
  const result = { recorded: true, action: 'checkin', eventId: 'synthetic', message: 'Synthetic committed result' };
  const t = await setup({ transport: { record: async event => { requests.push({ ...event }); if (++attempts === 1) throw new Error('Synthetic network loss'); return result; } } });
  await t.flow.start(); assert.equal(t.states.at(-1).pendingConfirmation, true);
  await t.flow.start(); assert.equal(t.calls.filter(c => c === 'capture').length, 1);
  await t.flow.retryConfirmation(); assert.deepEqual(requests[0], requests[1]); assert.equal(t.states.at(-1).result.recorded, true);
});
test('second-tab scanner ownership errors are explicit and cannot record', async () => {
  const t = await setup({ scanner: { runSession: async () => { throw Object.assign(new Error('Scanner in use in another tab.'), { code: 'SCANNER_IN_USE' }); } } });
  await t.flow.start(); assert.equal(t.states.at(-1).code, 'SCANNER_IN_USE'); assert.equal(t.calls.includes('record'), false);
});

test('SDK adapter drains an in-flight hardware capture before uninitialization after pause', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  let release, reached, hardwareSignal; const calls = [];
  const begun = new Promise(resolve => { reached = resolve; });
  const scanner = createMorFinAuth({ fetchImpl: async (url, options) => {
    const method = url.split('/').pop(); calls.push(method);
    const data = { ErrorCode: 0, ErrorDescription: 'OK' };
    if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Devices: MFS500';
    if (method === 'info') data.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC' };
    if (method === 'capture') { hardwareSignal = options.signal; await new Promise(resolve => { release = resolve; reached(); }); data.Quality = 70; }
    return new Response(JSON.stringify(data));
  } });
  const abort = new AbortController();
  const capture = scanner.runSession({ signal: abort.signal }, handle => handle.captureTemplate());
  await begun; abort.abort();
  assert.equal(hardwareSignal.aborted, false); assert.equal(calls.includes('uninitdevice'), false);
  release(); await assert.rejects(capture, /cancelled/i);
  assert.equal(calls.at(-1), 'uninitdevice'); assert.equal(calls.includes('gettemplate'), false);
});
test('a definitive membership rejection is not retained as an uncertain network event', async () => {
  let captures = 0;
  const t = await setup({ handle: { captureTemplate: async () => {
    if (++captures > 1) throw Object.assign(new Error('Synthetic disconnect'), { code: 'DEVICE_DISCONNECTED' });
    return { templateBase64: 'U1lOVEhFVElD', templateFormat: 'FMR_V2005' };
  } }, transport: { record: async () => { throw Object.assign(new Error('Synthetic membership rejection'), { response: { status: 403, data: { code: 'MEMBERSHIP_INELIGIBLE', error: 'Membership inactive' } } }); } } });
  await t.flow.start(); assert.equal(t.states.at(-1).phase, 'disconnected'); assert.ok(!t.states.some(s => s.pendingConfirmation));
});

test('each completed attempt reinitializes before the next capture without opening a new station or clearing the latch', async () => {
  let captures = 0, opened = 0, rearmed = 0, records = 0;
  const t = await setup({
    handle: { captureTemplate: async () => {
      if (++captures === 3) throw Object.assign(new Error('Synthetic disconnect'), { code: 'DEVICE_DISCONNECTED' });
      return { templateBase64: 'U1lOVEhFVElD', templateFormat: 'FMR_V2005' };
    } },
    transport: {
      open: async () => { opened++; return { stationToken: 'same-station' }; },
      rearm: async () => { rearmed++; },
      record: async () => ++records === 1
        ? { recorded: true, action: 'checkin', message: 'Synthetic checkin' }
        : { recorded: false, action: 'duplicate', code: 'DUPLICATE_SCAN', message: 'Synthetic duplicate' },
    },
  });
  await t.flow.start();
  assert.equal(captures, 3); assert.equal(t.calls.filter(c => c === 'reinitialize').length, 2);
  assert.equal(opened, 1); assert.equal(rearmed, 0);
  assert.ok(t.states.some(s => s.message === 'Reinitializing scanner for the next finger...'));
});
test('pause during reinitialization prevents the next capture', async () => {
  let captures = 0, release, reached;
  const resetting = new Promise(resolve => { reached = resolve; });
  const t = await setup({ handle: {
    captureTemplate: async () => { captures++; throw Object.assign(new Error('Synthetic timeout'), { code: 'CAPTURE_TIMEOUT' }); },
    reinitialize: () => new Promise(resolve => { release = resolve; reached(); }),
  } });
  const running = t.flow.start(); await resetting;
  const stopping = t.flow.stop('Paused'); release(); await stopping; await running;
  assert.equal(captures, 1); assert.equal(t.calls.includes('record'), false);
});
test('reinitialization failure stops scanning instead of starting a new capture', async () => {
  let captures = 0;
  const t = await setup({ handle: {
    captureTemplate: async () => { captures++; throw Object.assign(new Error('Synthetic poor capture'), { code: 'POOR_CAPTURE' }); },
    reinitialize: async () => { throw Object.assign(new Error('Synthetic disconnect'), { code: 'DEVICE_DISCONNECTED' }); },
  } });
  await t.flow.start(); assert.equal(captures, 1); assert.equal(t.states.at(-1).phase, 'disconnected');
});
test('owned SDK reinitialization performs cleanup/discovery/info before the next capture and refreshes device metadata', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  const calls = []; let initialized = 0;
  const scanner = createMorFinAuth({ fetchImpl: async url => {
    const method = url.split('/').pop(); calls.push(method);
    const data = { ErrorCode: 0, ErrorDescription: 'Success' };
    if (method === 'connecteddevicelist') data.ErrorDescription = 'Connected Device :MFS500';
    if (method === 'info') data.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC-' + ++initialized };
    if (method === 'capture') data.Quality = 70;
    if (method === 'gettemplate') data.TmpData = Buffer.from('FMR\0synthetic').toString('base64');
    return new Response(JSON.stringify(data));
  } });
  await scanner.runSession({}, async handle => {
    assert.equal((await handle.captureTemplate()).deviceSerial, 'SYNTHETIC-1');
    await handle.reinitialize();
    assert.equal(handle.device.serial, 'SYNTHETIC-2');
    assert.equal((await handle.captureTemplate()).deviceSerial, 'SYNTHETIC-2');
  });
  assert.deepEqual(calls, ['connecteddevicelist', 'checkdevice', 'info', 'capture', 'gettemplate', 'uninitdevice',
    'connecteddevicelist', 'checkdevice', 'info', 'capture', 'gettemplate', 'uninitdevice']);
});
