const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalMorFinIdentifier } = require('../services/localMorFinIdentifier');
const settings = () => ({ identificationMode: 'morfin-local-development', localServiceUrl: 'https://localhost:8030/morfinauth', searchMaxCandidates: 100, searchTimeoutMs: 15000 });
const template = () => Buffer.from('FMR\0synthetic-only');
const rows = () => [1, 2, 3].map(i => ({ _id: String(i), member: 'member-' + i, enrollmentReference: 'ref-' + i,
  schemaVersion: 2, templateFormat: 'FMR_V2005', encryptedTemplate: { synthetic: i } }));
const input = () => ({ probe: template(), templateFormat: 'FMR_V2005', challenge: 'server-challenge', eventId: 'server-event', stationContext: 'server-station', expiresAt: new Date(Date.now() + 45000) });
function harness(overrides = {}) {
  const candidates = rows(), calls = [], zeroed = [];
  const identifier = createLocalMorFinIdentifier({
    settings, environment: () => 'development', platform: () => 'win32', hasKey: () => true,
    loadCandidates: async () => candidates, loadSnapshot: async () => candidates,
    unseal: () => { const b = template(); zeroed.push(b); return b; },
    post: async (method, body, timeout) => { calls.push({ method, body, timeout }); return { ErrorCode: 0, Status: calls.length === 2 }; },
    ...overrides,
  });
  return { identifier, candidates, calls, zeroed };
}
test('server maps the sole SDK-positive enrollment after checking every template; no image is needed', async () => {
  const h = harness(), probe = input(), result = await h.identifier.identify(probe);
  assert.equal(result.outcome, 'identified'); assert.equal(result.memberId, 'member-2'); assert.equal(result.enrollmentReference, 'ref-2');
  assert.equal(result.challenge, probe.challenge); assert.equal(result.eventId, probe.eventId); assert.equal(result.stationContext, probe.stationContext);
  assert.equal(h.calls.length, 3); assert.equal(result.diagnostics.comparisons, 3);
  for (const call of h.calls) { assert.equal(call.method, 'verify'); assert.deepEqual(Object.keys(call.body).sort(), ['GalleryTemplate', 'ProbTemplate', 'TmpFormat']); assert.equal(call.body.TmpFormat, 0); assert.ok(call.timeout > 0 && call.timeout <= 2000); }
  assert.ok(h.zeroed.every(bytes => bytes.every(byte => byte === 0)));
});
test('zero matches are unknown; multiple distinct member matches are ambiguous, never first-positive', async () => {
  for (const status of [false, true]) {
    let comparisons = 0;
    const h = harness({ post: async () => { comparisons++; return { ErrorCode: '0', Status: status }; } });
    const result = await h.identifier.identify(input()); assert.equal(result.outcome, status ? 'ambiguous' : 'unknown'); assert.equal(comparisons, 3);
    assert.equal(result.memberId, undefined);
  }
});
test('a positive followed by SDK error cannot produce a partial successful identification', async () => {
  let i = 0;
  const h = harness({ post: async () => ++i === 1 ? { ErrorCode: 0, Status: true } : { ErrorCode: -2018, Status: true } });
  await assert.rejects(h.identifier.identify(input()), e => e.code === 'LOCAL_MATCHER_VENDOR_ERROR');
  assert.ok(h.zeroed.every(bytes => bytes.every(byte => byte === 0)));
});
test('HTTP/operation success alone is insufficient: unexpected matching status is rejected', async () => {
  const h = harness({ post: async () => ({ ErrorCode: 0, Status: 'true' }) });
  await assert.rejects(h.identifier.identify(input()), e => e.code === 'LOCAL_MATCHER_RESPONSE');
});
test('oversized gallery, incompatible active enrollments and decryption failure fail closed', async () => {
  const capacity = harness({ settings: () => ({ ...settings(), searchMaxCandidates: 2 }) });
  await assert.rejects(capacity.identifier.identify(input()), e => e.code === 'LOCAL_MATCHER_CAPACITY'); assert.equal(capacity.calls.length, 0);
  const legacy = harness({ loadCandidates: async () => [{ ...rows()[0], schemaVersion: 1 }] });
  await assert.rejects(legacy.identifier.identify(input()), e => e.code === 'ENROLLMENT_REQUIRES_REENROLLMENT');
  const corrupt = harness({ unseal: () => { throw new Error('Synthetic tamper'); } });
  await assert.rejects(corrupt.identifier.identify(input()), e => e.code === 'ENROLLMENT_DECRYPT_FAILED');
});
test('changing enrollments and exceeding total deadline cannot accept an incomplete search', async () => {
  const changing = harness({ loadSnapshot: async () => rows().slice(0, 2) });
  await assert.rejects(changing.identifier.identify(input()), e => e.code === 'ENROLLMENT_SET_CHANGED');
  let time = 1000;
  const timeout = harness({ clock: () => time, post: async () => { time += 16000; return { ErrorCode: 0, Status: true }; } });
  await assert.rejects(timeout.identifier.identify({ ...input(), expiresAt: new Date(100000) }), e => e.code === 'LOCAL_MATCHER_TIMEOUT');
});
test('the local matcher cannot enable itself in production, Linux, with remote service URLs or missing keys', () => {
  for (const overrides of [
    { environment: () => 'production' }, { platform: () => 'linux' },
    { settings: () => ({ ...settings(), identificationMode: 'disabled' }) },
    { settings: () => ({ ...settings(), localServiceUrl: 'https://remote.example/morfinauth' }) },
    { hasKey: () => { throw new Error('Missing key'); } },
  ]) assert.equal(harness(overrides).identifier.available(), false);
});
test('overlapping searches are rejected while the first one owns the matcher', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const h = harness({ loadCandidates: async () => { await pending; return rows(); } });
  const first = h.identifier.identify(input());
  await assert.rejects(h.identifier.identify(input()), e => e.code === 'LOCAL_MATCHER_BUSY');
  release(); assert.equal((await first).outcome, 'identified');
});
test('the workstation boundary rejects remote peers, remote origins and forwarded requests', () => {
  const config = require('../config/env'), guard = require('../middleware/localBiometricWorkstation');
  const oldEnv = config.nodeEnv, oldMode = config.biometric.identificationMode;
  config.nodeEnv = 'development'; config.biometric.identificationMode = 'morfin-local-development';
  try {
    for (const req of [
      { socket: { remoteAddress: '203.0.113.1' }, headers: {} },
      { socket: { remoteAddress: '127.0.0.1' }, headers: { origin: 'https://remote.example' } },
      { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '127.0.0.1' } },
    ]) {
      let status; let response; guard(req, { status: code => { status = code; return { json: body => { response = body; } }; } }, () => assert.fail('Remote request was allowed'));
      assert.equal(status, 403); assert.equal(response.code, 'LOCAL_WORKSTATION_REQUIRED');
    }
  } finally { config.nodeEnv = oldEnv; config.biometric.identificationMode = oldMode; }
});

test('an uncertain SDK transport timeout blocks further comparisons until service/backend restart', async () => {
  let calls = 0;
  const h = harness({ post: async () => { calls++; throw Object.assign(new Error('Synthetic request timeout'), { code: 'LOCAL_MATCHER_TIMEOUT' }); } });
  await assert.rejects(h.identifier.identify(input()), e => e.code === 'LOCAL_MATCHER_RECOVERY_REQUIRED');
  assert.equal(h.identifier.available(), false);
  await assert.rejects(h.identifier.identify(input()), e => e.code === 'IDENTIFICATION_UNAVAILABLE');
  assert.equal(calls, 1);
});

test('installed SDK omitted-false response does not stop the search before the matching member', async () => {
  let compared = 0;
  const h = harness({ post: async () => ++compared === 2
    ? { ErrorCode: '0', ErrorDescription: 'Success', Status: true }
    : { ErrorCode: '0', ErrorDescription: 'Success', WSQInfo: '' } });
  const result = await h.identifier.identify(input());
  assert.equal(result.outcome, 'identified'); assert.equal(result.memberId, 'member-2'); assert.equal(compared, 3);
});
test('all omitted-false responses mean unknown; malformed statuses and SDK failures cannot identify', async () => {
  const h = harness({ post: async () => ({ ErrorCode: '0', ErrorDescription: 'Success' }) });
  assert.equal((await h.identifier.identify(input())).outcome, 'unknown');
  for (const result of [
    { ErrorCode: 0 }, { ErrorCode: 0, ErrorDescription: 'Unexpected response' },
    { ErrorCode: 0, ErrorDescription: 'Success', Status: null },
    { ErrorCode: 0, ErrorDescription: 'Success', Status: 'true' },
    { ErrorCode: 0, ErrorDescription: 'Success', Status: 1 },
    { ErrorCode: -2018, ErrorDescription: 'Success', Status: true },
  ]) await assert.rejects(harness({ post: async () => result }).identifier.identify(input()));
});
test('local diagnostic adapter also normalizes the observed omitted-false variant', async () => {
  const { createMorFinAuth } = await import('../../client/src/services/morfinAuth.mjs');
  const adapter = createMorFinAuth({ fetchImpl: async url => {
    const method = url.split('/').pop();
    const result = { ErrorCode: '0', ErrorDescription: 'Success' };
    if (method === 'connecteddevicelist') result.ErrorDescription = 'Connected Device :MFS500';
    if (method === 'info') result.DeviceInfo = { Model: 'MFS500', SerialNo: 'SYNTHETIC' };
    return new Response(JSON.stringify(result));
  } });
  const result = await adapter.verify({ probeTemplate: template().toString('base64'), galleryTemplate: template().toString('base64') });
  assert.equal(result.matched, false);
});
