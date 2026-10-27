const delay = (milliseconds, signal) => new Promise(resolve => {
  if (signal?.aborted) return resolve();
  const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, milliseconds);
  signal?.addEventListener('abort', done, { once: true });
});
export function createAttendanceScanner({ scanner, transport, onState, wait = delay }) {
  let epoch = 0, abort, running, station, pending, desired = false;
  const emit = value => onState(value);
  const current = (generation, signal) => generation === epoch && !signal.aborted && desired;
  const close = async token => { if (token) { try { await transport.close(token); } catch {} } };
  async function start({ recover = false } = {}) {
    if (running) return running;
    if (pending) { emit({ phase: 'error', code: 'CONFIRMATION_PENDING', pendingConfirmation: true, message: 'Attendance was not confirmed. Retry confirmation with the same event, or Pause and review recent events.' }); return; }
    desired = true;
    const generation = ++epoch;
    abort = new AbortController();
    const signal = abort.signal;
    running = (async () => {
      try {
        emit({ phase: 'initializing', message: recover ? 'Recovering scanner...' : 'Checking scanner and identification service...' });
        if (recover) await scanner.recover({ signal });
        const policy = await transport.capabilities(signal);
        if (!current(generation, signal)) return;
        await scanner.runSession({ signal, requireLock: true }, async handle => {
          if (!current(generation, signal)) return;
          emit({ phase: 'initializing', device: handle.device, message: 'MFS500 connected and initialized.' });
          if (!policy.identificationAvailable) {
            emit({ phase: 'paused', code: 'IDENTIFICATION_UNAVAILABLE', device: handle.device,
              message: 'Automatic attendance unavailable. ' + policy.reason });
            return;
          }
          const opened = await transport.open(signal);
          if (!current(generation, signal)) { await close(opened.stationToken); return; }
          station = opened.stationToken;
          let candidates = [];
          if (policy.mode === 'kiosk-assisted' && typeof transport.candidates === 'function') {
            candidates = await transport.candidates(signal).catch(() => []);
          }
          let needsDeviceReset = false;
          while (current(generation, signal)) {
            let capture;
            try {
              if (needsDeviceReset) {
                emit({ phase: 'rearming', device: handle.device, message: 'Reinitializing scanner for the next finger...' });
                await handle.reinitialize();
                if (!current(generation, signal)) break;
                needsDeviceReset = false;
              }
              const challenge = await transport.challenge(station, signal);
              if (!current(generation, signal)) break;
              emit({ phase: 'capturing', device: handle.device, message: 'Ready - place your finger.' });
              needsDeviceReset = true;
              capture = await handle.captureTemplate();
              if (!current(generation, signal)) break;
              emit({ phase: 'identifying', device: handle.device, message: 'Identifying member...' });

              if (policy.mode === 'kiosk-assisted') {
                if (!candidates || candidates.length === 0) {
                  candidates = await transport.candidates(signal).catch(() => []);
                }
                let match = null;
                const startMatch = Date.now();
                for (const candidate of (candidates || [])) {
                  if (!current(generation, signal)) break;
                  try {
                    const check = await scanner.verify({
                      probeTemplate: capture.templateBase64,
                      galleryTemplate: candidate.galleryTemplate,
                      templateFormat: 'FMR_V2005',
                      signal,
                    });
                    if (check.matched) {
                      match = candidate;
                      break;
                    }
                  } catch (vErr) {
                    if (['DEVICE_DISCONNECTED', 'SERVICE_UNAVAILABLE'].includes(vErr?.code)) throw vErr;
                  }
                }
                capture = null;
                if (!current(generation, signal)) break;
                if (!match) {
                  emit({ phase: 'result', code: 'UNKNOWN_FINGERPRINT', message: 'Fingerprint is not recognized. No attendance recorded.' });
                  await wait(policy.rearmSeconds * 1000, signal);
                  continue;
                }
                await transport.identify(station, challenge.verificationToken, {
                  matchedMemberId: match.memberId,
                  matchedEnrollmentReference: match.enrollmentReference,
                  diagnostics: { comparisons: 1, elapsedMs: Date.now() - startMatch },
                }, signal);
              } else {
                await transport.identify(station, challenge.verificationToken, capture, signal);
                capture = null;
              }

              if (!current(generation, signal)) break;
              emit({ phase: 'recording', device: handle.device, message: 'Confirming attendance with the server...' });
              pending = { stationToken: station, verificationToken: challenge.verificationToken, eventId: challenge.eventId };
              const result = await transport.record(pending, signal);
              pending = null;
              if (!current(generation, signal)) break;
              emit({ phase: 'result', device: handle.device, result, message: result.message });
              if (result.action === 'review') return;
              await wait(policy.rearmSeconds * 1000, signal);
              if (current(generation, signal)) emit({ phase: 'rearming', device: handle.device, message: 'Remove your finger. Preparing for the next member...' });
            } catch (error) {
              capture = null;
              if (!current(generation, signal)) break;
              const code = error.response?.data?.code || error.code;
              if (pending && error.response?.status < 500) pending = null;
              if (code === 'CAPTURE_TIMEOUT') { await wait(300, signal); continue; }
              if (['POOR_CAPTURE', 'UNKNOWN_FINGERPRINT', 'AMBIGUOUS_FINGERPRINT', 'MEMBERSHIP_INELIGIBLE', 'ENROLLMENT_INACTIVE'].includes(code)) {
                emit({ phase: 'result', code, message: error.response?.data?.error || error.message });
                await wait(policy.rearmSeconds * 1000, signal);
                continue;
              }
              throw error;
            }
          }
        });
      } catch (error) {
        if (current(generation, signal)) {
          const code = error.response?.data?.code || error.code;
          emit({ phase: ['DEVICE_DISCONNECTED', 'SERVICE_UNAVAILABLE'].includes(code) ? 'disconnected' : 'error', code,
            pendingConfirmation: !!pending, message: pending ? 'Attendance was not confirmed. Retry confirmation with the same event; do not scan again.' : error.response?.data?.error || error.message });
        }
      } finally {
        // Keep a pending record context for an explicit retry, never an offline queue.
        if (!pending) { const token = station; station = null; await close(token); }
        running = null;
      }
    })();
    return running;
  }
  async function stop(message = 'Scanning paused.') {
    desired = false; epoch += 1; abort?.abort();
    const token = station; station = null;
    // A committed result can still be fetched idempotently; cancellation blocks unsaved writes.
    emit({ phase: 'paused', pendingConfirmation: !!pending, message });
    await close(token);
    if (running) await running;
  }
  async function confirmRemoval() {
    if (!station) { emit({ phase: 'paused', message: 'Resume scanning before confirming finger removal.' }); return; }
    await transport.rearm(station);
  }
  async function retryConfirmation() {
    if (!pending) return;
    const attempt = pending;
    const generation = epoch;
    try {
      const result = await transport.record(attempt);
      pending = null;
      const token = station; station = null; await close(token);
      if (generation === epoch) emit({ phase: 'result', result, message: result.message + '. Press Resume to continue.' });
    } catch (error) {
      if (generation === epoch) emit({ phase: 'error', pendingConfirmation: true, message: 'Attendance is still not confirmed. ' + (error.response?.data?.error || error.message) });
    }
  }
  async function discardPending() {
    await stop('Paused. Review recent events before resuming.');
    pending = null;
    emit({ phase: 'paused', message: 'Paused. Review recent events before resuming.' });
  }
  return { start, stop, confirmRemoval, retryConfirmation, discardPending };
}
