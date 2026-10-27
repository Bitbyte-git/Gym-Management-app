const https = require('node:https');
const tls = require('node:tls');
const Enrollment = require('../models/BiometricEnrollment');
const { decrypt, keyFor } = require('./biometricCrypto');
const config = require('../config/env');
const failure = (code, message, statusCode = 503) => Object.assign(new Error(message), { code, statusCode });
const isLoopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
function serviceUrl(settings) {
  const url = new URL(settings.localServiceUrl);
  if (url.protocol !== 'https:' || !isLoopback(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw failure('LOCAL_MATCHER_CONFIGURATION', 'Local matching requires a loopback HTTPS MorFinAuth URL');
  }
  return url;
}
let agent;
function trustedAgent() {
  if (!agent) {
    // Include the workstation's managed CA store without bypassing TLS verification.
    const ca = typeof tls.getCACertificates === 'function'
      ? [...tls.getCACertificates('default'), ...tls.getCACertificates('system')]
      : undefined;
    agent = new https.Agent({ keepAlive: true, maxSockets: 1, ...(ca ? { ca } : {}) });
  }
  return agent;
}
function postVendor(settings, method, body, timeoutMs) {
  const base = serviceUrl(settings);
  const url = new URL(base.href.replace(/\/$/, '') + '/' + method);
  return new Promise((resolve, reject) => {
    let settled = false, timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const request = https.request(url, { method: 'POST', agent: trustedAgent(),
      headers: { 'Content-Type': 'application/json; charset=utf-8' } }, response => {
      let chunks = [], length = 0;
      response.on('data', chunk => {
        length += chunk.length;
        if (length > 64 * 1024) {
          finish(failure('LOCAL_MATCHER_RESPONSE', 'MorFinAuth returned an oversized matching response'));
          response.destroy(); request.destroy();
        } else chunks.push(chunk);
      });
      response.on('error', () => finish(failure('LOCAL_MATCHER_SERVICE', 'MorFinAuth connection was interrupted')));
      response.on('end', () => {
        if (settled) return;
        if (response.statusCode !== 200) return finish(failure('LOCAL_MATCHER_SERVICE', 'MorFinAuth matching request failed'));
        try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(failure('LOCAL_MATCHER_RESPONSE', 'MorFinAuth returned invalid matching JSON')); }
        finally { chunks = []; }
      });
    });
    request.on('error', error => {
      const cert = /CERT|TLS|SELF_SIGNED|ISSUER/.test(error.code || '');
      finish(failure(cert ? 'LOCAL_MATCHER_CERTIFICATE' : 'LOCAL_MATCHER_SERVICE', cert
        ? 'MorFinAuth certificate is not trusted by Node. Configure the workstation CA trust; do not disable verification.'
        : 'Cannot reach local MorFinAuth. Check the Windows service and scanner.'));
    });
    timer = setTimeout(() => {
      finish(failure('LOCAL_MATCHER_TIMEOUT', 'MorFinAuth template search timed out. No identity was accepted.'));
      request.destroy();
    }, timeoutMs);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const identityKey = rows => JSON.stringify(rows.map(row => [String(row._id), String(row.member), row.enrollmentReference]).sort((a, b) => a[0].localeCompare(b[0])));
function createLocalMorFinIdentifier({ settings, environment, platform, loadCandidates, loadSnapshot, unseal, post, hasKey, clock = Date.now }) {
  let busy = false, uncertainTransport = false;
  function status() {
    const c = settings();
    if (c.identificationMode !== 'morfin-local-development') return { enabled: false, reason: 'Local template search is disabled. Configure the development matcher on the scanner-connected Windows PC.' };
    if (environment() !== 'development' || platform() !== 'win32') return { enabled: false, reason: 'Direct MorFinAuth search is restricted to development on the scanner-connected Windows PC. Remote production needs an authenticated agent or server matcher.' };
    if (uncertainTransport) return { enabled: false, reason: 'A matching connection ended without confirming completion. Restart MorFinAuth and the backend before resuming local matching.' };
    try { serviceUrl(c); hasKey(); }
    catch { return { enabled: false, reason: 'Local matcher configuration or backend biometric encryption key is missing or invalid.' }; }
    return { enabled: true, reason: 'Local development: the server compares encrypted member templates using MorFinAuth verify.', mode: 'morfin-local-development' };
  }
  async function identify(input) {
    const state = status();
    if (!state.enabled) throw failure('IDENTIFICATION_UNAVAILABLE', state.reason);
    if (busy) throw failure('LOCAL_MATCHER_BUSY', 'Another local template search is running. Retry after it finishes.');
    if (!input || !Buffer.isBuffer(input.probe) || input.templateFormat !== 'FMR_V2005' ||
        input.probe.length > 64 * 1024 || input.probe.subarray(0, 4).toString('ascii') !== 'FMR\0') {
      throw failure('INVALID_TEMPLATE', 'A valid FMR_V2005 probe template is required', 400);
    }
    const c = settings();
    const started = clock(), expiry = new Date(input.expiresAt).getTime();
    if (!Number.isFinite(expiry)) throw failure('VERIFICATION_EXPIRED', 'A server-issued verification expiry is required', 403);
    const deadline = Math.min(started + c.searchTimeoutMs, expiry - 250);
    const remaining = () => {
      const ms = deadline - clock();
      if (ms <= 0) throw failure('LOCAL_MATCHER_TIMEOUT', 'Template search exceeded its time budget. No identity was accepted.');
      return ms;
    };
    busy = true;
    let probeBase64;
    try {
      remaining();
      // Active records are not silently skipped: an incompatible record could hide a second match.
      const rows = await loadCandidates(c.searchMaxCandidates + 1);
      remaining();
      if (rows.length > c.searchMaxCandidates) throw failure('LOCAL_MATCHER_CAPACITY', 'The enrolled gallery exceeds the local development search limit. No partial search was accepted.');
      for (const row of rows) {
        if (row.schemaVersion !== 2 || row.templateFormat !== 'FMR_V2005' || !row.encryptedTemplate || !row.member) {
          throw failure('ENROLLMENT_REQUIRES_REENROLLMENT', 'An active enrollment lacks a compatible encrypted FMR_V2005 template. Explicit re-enrollment is required before searching.');
        }
      }
      probeBase64 = input.probe.toString('base64');
      const matches = new Map();
      let compared = 0;
      for (const row of rows) {
        let gallery, galleryBase64;
        try {
          try { gallery = unseal(row.encryptedTemplate, String(row.member) + ':' + row.enrollmentReference + ':template'); }
          catch { throw failure('ENROLLMENT_DECRYPT_FAILED', 'An enrolled template could not be decrypted. Check retained encryption keys; no identity was accepted.'); }
          if (gallery.length > 64 * 1024 || gallery.subarray(0, 4).toString('ascii') !== 'FMR\0') throw failure('INVALID_ENROLLED_TEMPLATE', 'An enrolled template is invalid. No partial search was accepted.');
          galleryBase64 = gallery.toString('base64');
          // Documented MORFIN Auth operation. SDK decides the match; no custom score/threshold.
          let result;
          try {
            result = await post('verify', { ProbTemplate: probeBase64, GalleryTemplate: galleryBase64, TmpFormat: 0 }, Math.min(2000, remaining()));
          } catch (error) {
            // Closing an HTTP connection does not prove the native matcher has stopped.
            if (['LOCAL_MATCHER_TIMEOUT', 'LOCAL_MATCHER_SERVICE'].includes(error.code)) {
              uncertainTransport = true;
              throw failure('LOCAL_MATCHER_RECOVERY_REQUIRED', 'Matching completion was not confirmed. Restart MorFinAuth and the backend before scanning again.');
            }
            throw error;
          }
          remaining();
          if (result?.ErrorCode !== 0 && result?.ErrorCode !== '0') {
            const code = String(result?.ErrorCode);
            const message = ['-1603', '-2018'].includes(code) ? 'MorFinAuth rejected the SDK license/client key.'
              : ['-1610', '-2025'].includes(code) ? 'MorFinAuth is not initialized. Close other scanner tools and use Retry scanner.'
              : 'MorFinAuth rejected a template comparison. No partial search was accepted.';
            throw failure('LOCAL_MATCHER_VENDOR_ERROR', message);
          }
          // Installed MorFinAuth omits the default false Status on non-matches
          // (ErrorCode "0", ErrorDescription "Success"). Only explicit true can identify.
          const omittedFalse = !Object.prototype.hasOwnProperty.call(result, 'Status') &&
            typeof result.ErrorDescription === 'string' && result.ErrorDescription.trim() === 'Success';
          if (typeof result.Status !== 'boolean' && !omittedFalse) throw failure('LOCAL_MATCHER_RESPONSE', 'MorFinAuth returned an undocumented matching status');
          compared += 1;
          if (result.Status === true) matches.set(String(row.member), row);
        } finally { gallery?.fill(0); galleryBase64 = undefined; }
      }
      remaining();
      const after = await loadSnapshot(c.searchMaxCandidates + 1);
      remaining();
      if (identityKey(rows) !== identityKey(after)) throw failure('ENROLLMENT_SET_CHANGED', 'Enrollments changed during matching. Please scan again.');
      const diagnostics = { comparisons: compared, elapsedMs: Math.max(0, clock() - started) };
      if (matches.size === 0) return { outcome: 'unknown', diagnostics };
      if (matches.size > 1) return { outcome: 'ambiguous', diagnostics };
      const match = [...matches.values()][0];
      return { outcome: 'identified', memberId: String(match.member), enrollmentReference: match.enrollmentReference,
        challenge: input.challenge, eventId: input.eventId, stationContext: input.stationContext, diagnostics };
    } finally { probeBase64 = undefined; busy = false; }
  }
  return { status, available: () => status().enabled, identify };
}
const active = () => ({ isActive: true, enrollmentStatus: 'enrolled' });
const local = createLocalMorFinIdentifier({
  settings: () => config.biometric, environment: () => config.nodeEnv, platform: () => process.platform,
  hasKey: () => keyFor(config.biometric.keyVersion),
  loadCandidates: max => Enrollment.find(active()).select('_id member enrollmentReference schemaVersion templateFormat +encryptedTemplate').sort({ _id: 1 }).limit(max).lean(),
  loadSnapshot: max => Enrollment.find(active()).select('_id member enrollmentReference').sort({ _id: 1 }).limit(max).lean(),
  unseal: decrypt,
  post: (method, body, timeoutMs) => postVendor(config.biometric, method, body, timeoutMs),
});
module.exports = { ...local, createLocalMorFinIdentifier, postVendor };
