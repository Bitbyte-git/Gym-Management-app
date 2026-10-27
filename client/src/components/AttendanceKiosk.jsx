import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Pause, Play, RefreshCw, Users, Clock, ShieldCheck, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import api from '../services/api';
import { createMorFinAuth } from '../services/morfinAuth.mjs';
import { createAttendanceScanner } from '../services/attendanceScanner.mjs';
import AttendancePopup from './AttendancePopup';

const initial = { phase: 'initializing', message: 'Checking scanner...' };
export default function AttendanceKiosk({ user, onRecorded }) {
  const [state, setState] = useState(initial);
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [draining, setDraining] = useState(false);
  const [controlError, setControlError] = useState('');
  const [popup, setPopup] = useState(null);
  const clientKey = useRef('');
  const controller = useRef(null), paused = useRef(false), recorded = useRef(onRecorded);
  recorded.current = onRecorded;
  const refresh = useRef(null);

  const triggerPopup = data => {
    setPopup({ ...data, id: Date.now() });
  };
  useEffect(() => {
    if (!['admin', 'reception'].includes(user.role)) return;
    let live = true, poll, overviewRequest, stopTask, exiting = false;
    const unpack = request => request.then(r => r.data.data);
    const transport = {
      capabilities: signal => unpack(api.get('/attendance/biometric/capabilities', { signal })),
      candidates: signal => unpack(api.get('/attendance/biometric/candidates', { signal })),
      open: signal => unpack(api.post('/attendance/biometric/stations', {}, { signal })),
      close: stationToken => unpack(api.post('/attendance/biometric/stations/close', { stationToken })),
      challenge: (stationToken, signal) => unpack(api.post('/attendance/biometric/challenges', { stationToken }, { signal })),
      identify: (stationToken, verificationToken, captureOrMatch, signal) => {
        if (captureOrMatch?.matchedMemberId) {
          return unpack(api.post('/attendance/biometric/identify', {
            stationToken,
            verificationToken,
            matchedMemberId: captureOrMatch.matchedMemberId,
            matchedEnrollmentReference: captureOrMatch.matchedEnrollmentReference,
            diagnostics: captureOrMatch.diagnostics,
          }, { signal }));
        }
        return unpack(api.post('/attendance/biometric/identify', {
          stationToken,
          verificationToken,
          probeTemplate: captureOrMatch?.templateBase64,
          templateFormat: captureOrMatch?.templateFormat,
        }, { signal }));
      },
      record: (event, signal) => unpack(api.post('/attendance/biometric/record', event, { signal })),
      rearm: stationToken => unpack(api.post('/attendance/biometric/stations/rearm', { stationToken })),
    };
    const loadOverview = async () => {
      overviewRequest?.abort(); overviewRequest = new AbortController();
      try {
        const data = await unpack(api.get('/attendance/biometric/overview', { signal: overviewRequest.signal }));
        if (live) { setOverview(data); setOverviewError(''); }
      } catch (error) {
        if (live && !overviewRequest.signal.aborted) setOverviewError(error.response?.data?.error || 'Could not refresh attendance. Displayed counts may be out of date.');
      }
    };
    refresh.current = loadOverview;
    const scanner = createMorFinAuth({ baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth' });
    const sessionRunner = scanner.runSession;
    scanner.runSession = (options, task) => sessionRunner({ ...options, clientKey: clientKey.current }, task);
    const flow = createAttendanceScanner({ scanner, transport, onState: next => {
      if (!live || exiting) return;
      setState(next);
      if (next.result?.recorded) {
        loadOverview();
        recorded.current?.();
        triggerPopup({
          type: 'success',
          title: 'Thank you! Attendance marked',
          subtitle: next.result.reconfirmed
            ? (next.result.message || 'Check-in confirmed. You are already checked in.')
            : next.result.action === 'checkout'
              ? (next.result.message || `Check-out recorded (${next.result.sessionDurationFormatted || 'session workout'}).`)
              : 'Check-in recorded successfully. Welcome to Vino Fitness Studio!',
          member: next.result.member,
          action: next.result.action === 'checkout' ? 'Check out' : 'Check in',
          sessionName: next.result.sessionName,
          duration: next.result.action === 'checkout' ? next.result.sessionDurationFormatted : null,
          dailySpending: next.result.dailySpending,
        });
      } else if (
        next.code === 'UNKNOWN_FINGERPRINT' ||
        next.code === 'POOR_CAPTURE' ||
        next.code === 'AMBIGUOUS_FINGERPRINT' ||
        (next.phase === 'result' && !next.result?.recorded)
      ) {
        triggerPopup({
          type: 'error',
          title: 'Try again, not Matched',
          subtitle: next.message || 'Fingerprint not recognized. Please scan your finger again.',
        });
      }
    } });
    controller.current = flow;
    const stop = reason => { stopTask = (async () => { if (live) setDraining(true); await flow.stop(reason); if (live) setDraining(false); })(); return stopTask; };
    const visibility = () => {
      if (document.hidden) void stop('Paused while this tab is hidden. Waiting for any active capture to finish.');
      else if (!paused.current && !exiting) void (async () => { await stopTask; if (live && !document.hidden && !paused.current && !exiting) await flow.start(); })();
    };
    const logout = () => { exiting = true; paused.current = true; void stop('Signing out. Scanning stopped.'); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pulsefit:auth-stopping', logout);
    if (!document.hidden) void flow.start();
    const pollOverview = async () => { if (!live) return; if (!document.hidden) await loadOverview(); if (live) poll = setTimeout(pollOverview, 15000); };
    void pollOverview();
    return () => {
      live = false; exiting = true; clientKey.current = ''; refresh.current = null; clearTimeout(poll); overviewRequest?.abort();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pulsefit:auth-stopping', logout);
      void flow.stop('Attendance page closed.');
      controller.current = null;
    };
  }, [user.id, user._id, user.role]);

  async function control(action) {
    setControlError('');
    try { await action(); } catch (error) { setControlError(error.response?.data?.error || error.message); }
  }
  const pause = () => control(async () => { paused.current = true; setDraining(true); await controller.current?.stop('Scanning paused.'); setDraining(false); });
  const resume = recover => control(async () => { paused.current = false; setState(initial); await controller.current?.start({ recover }); });
  const result = state.result;
  const timezone = result?.timeZone || overview?.timeZone || 'Asia/Kolkata';
  const time = timestamp => new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(timestamp));
  const active = ['initializing', 'capturing', 'identifying', 'recording', 'rearming'].includes(state.phase);
  const closeStaleVisit = async (row) => {
    try {
      const memberId = row.member?._id || row.member?.id || row.member;
      await api.post('/attendance/manual-checkout', {
        memberId,
        notes: 'Reviewed and closed stale open visit (default 60m workout)',
        duration: 60,
      });
      refresh.current?.();
      recorded.current?.();
      triggerPopup({
        type: 'success',
        title: 'Thank you! Attendance marked',
        subtitle: `Visit closed for ${row.member?.fullName || 'member'}. 60m session workout recorded.`,
        member: row.member,
        action: 'Check out',
        duration: '1h 0m',
      });
    } catch (err) {
      const errTxt = err.response?.data?.error || err.message || 'Could not close stale visit';
      setControlError(errTxt);
      triggerPopup({
        type: 'error',
        title: 'Try again, not Matched',
        subtitle: errTxt,
      });
    }
  };

  return <section className="attendance-kiosk" aria-label="Automatic fingerprint attendance">
    <AttendancePopup popup={popup} onClose={() => setPopup(null)} />
    <div className="kiosk-status"><span className={'scanner-dot ' + (state.device ? 'connected' : '')} /><span>{state.device ? state.device.model + ' connected' : 'Scanner connection not confirmed'}</span><span className="kiosk-phase">{state.phase}</span>{overview?.identificationAvailable && overview?.developmentOnly && <span>Local development matching</span>}</div>
    <div className="kiosk-instruction"><Fingerprint aria-hidden="true" /><div><p className="eyebrow">BIOMETRIC ATTENDANCE</p><h2>{state.phase === 'capturing' ? 'Place your finger' : state.code === 'SCANNER_IN_USE' ? 'Scanner in use in another tab' : state.code === 'IDENTIFICATION_UNAVAILABLE' ? 'Automatic attendance unavailable' : state.phase === 'paused' ? 'Scanning paused' : 'Member check-in / check-out'}</h2><p role="status" aria-live="polite">{state.message}</p></div></div>
    <details><summary>Workstation SDK configuration</summary><label>Client key, only if supplied by Mantra<input type="password" autoComplete="off" disabled={active || draining} onChange={event => { clientKey.current = event.target.value; }} /></label></details>
    <div className="biometric-actions">
      <button className="outline-btn" disabled={draining} onClick={pause}><Pause size={16} /> Pause</button>
      <button className="lime-btn" disabled={active || draining || state.pendingConfirmation} onClick={() => resume(false)}><Play size={16} /> Resume</button>
      <button className="outline-btn" disabled={active || draining || state.pendingConfirmation} onClick={() => resume(true)}><RefreshCw size={16} /> Retry scanner</button>
      {(result?.requiresRemovalConfirmation || result?.recorded) && <button className="outline-btn" disabled={draining} onClick={() => control(() => controller.current?.confirmRemoval())}>Confirm finger removed</button>}
      {state.pendingConfirmation && <><button className="outline-btn" onClick={() => control(() => controller.current?.retryConfirmation())}>Retry attendance confirmation</button><button className="ghost-btn" onClick={() => control(async () => { paused.current = true; await controller.current?.discardPending(); })}>Cancel pending attempt and review</button></>}
    </div>
    {draining && <p>Waiting for the current finite capture to finish before releasing the scanner.</p>}
    {controlError && <p role="alert">{controlError}</p>}
    {result && <article className={'kiosk-result ' + (result.recorded ? 'confirmed' : 'ignored')}>
      <span className="kiosk-avatar" aria-label="Member default avatar">{result.member?.avatarInitials || 'VF'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{result.member?.fullName}</h3>
          {result.sessionName && (
            <span className={`session-badge ${result.sessionName}`}>
              {result.sessionName} session
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0', fontWeight: 600, color: result.recorded ? 'var(--lime)' : '#b68d45' }}>
          {result.recorded
            ? (result.action === 'checkin' ? 'CHECKED IN' : `CHECKED OUT (${result.sessionDurationFormatted || '0m'} session workout)`)
            : (result.action === 'review' ? 'REVIEW REQUIRED' : 'ATTENDANCE ALREADY RECORDED')}
        </p>
        <time dateTime={result.timestamp}>{time(result.timestamp)}</time>
        {result.dailySpending && (
          <div className="kiosk-spending-pill">
            <span>Today's Total Gym Time:</span>
            <strong>{result.dailySpending.totalHoursFormatted}</strong>
            {result.dailySpending.breakdown && (
              <small style={{ color: 'var(--muted)', marginLeft: '4px' }}>
                (Morning: {result.dailySpending.breakdown.morningFormatted} | Afternoon: {result.dailySpending.breakdown.afternoonFormatted} | Evening: {result.dailySpending.breakdown.eveningFormatted})
              </small>
            )}
          </div>
        )}
        {result.punchesCount > 1 && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            ✓ {result.punchesCount} punches noted • Last incoming punch saved as check-out
          </p>
        )}
        {result.staleSession && <p>Stale session closed under the configured review policy.</p>}
      </div>
    </article>}
    <div className="kiosk-kpi-grid">
      <article className="kiosk-kpi-card live">
        <div className="kpi-icon-wrap"><Users size={22} /></div>
        <div>
          <span className="kpi-label">CURRENTLY IN STUDIO</span>
          <div className="kpi-value-row">
            <strong>{overview?.currentlyPresent ?? 0}</strong>
            <span className="pulse-badge"><span className="pulse-dot" /> Live Active</span>
          </div>
          <small>Members currently training inside gym</small>
        </div>
      </article>

      <article className="kiosk-kpi-card session">
        <div className="kpi-icon-wrap"><Clock size={22} /></div>
        <div>
          <span className="kpi-label">OPERATING SESSION</span>
          <div className="kpi-value-row">
            <strong style={{ fontSize: '18px' }}>
              {new Date().getHours() < 12 ? 'Morning Session' : new Date().getHours() < 16 ? 'Afternoon Session' : 'Evening Session'}
            </strong>
          </div>
          <small>{new Date().getHours() < 12 ? '5:00 AM – 11:59 AM' : new Date().getHours() < 16 ? '12:00 PM – 3:59 PM' : '4:00 PM – 10:00 PM'} (Flexible entry)</small>
        </div>
      </article>

      <article className="kiosk-kpi-card hardware">
        <div className="kpi-icon-wrap"><Fingerprint size={22} /></div>
        <div>
          <span className="kpi-label">BIOMETRIC HARDWARE</span>
          <div className="kpi-value-row">
            <strong style={{ fontSize: '17px' }}>{state.device ? state.device.model : 'MFS500 Scanner'}</strong>
            <span className={`scanner-status-tag ${state.device ? 'ready' : 'idle'}`}>
              {state.device ? 'Connected' : 'Armed'}
            </span>
          </div>
          <small>{overview?.cooldownSeconds ?? 60}s protection window | Multi-punch tracking</small>
        </div>
      </article>
    </div>

    {overviewError && <p role="alert" className="error-message" style={{ margin: '12px 0 0' }}>{overviewError}</p>}

    {!!overview?.staleSessions?.length && <aside className="kiosk-stale">
      <h3>Open visits requiring review</h3>
      <p>Visits open for {overview.staleHours} hours or more. Review and click "Close visit" to record a 60-minute session.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {overview.staleSessions.map(row => (
          <li key={row._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span><b>{row.member?.fullName || 'Member unavailable'}</b> <small style={{ color: 'var(--muted)' }}>(checked in {time(row.checkInTime)})</small></span>
            <button className="outline-btn" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => closeStaleVisit(row)}>
              Close visit (60m)
            </button>
          </li>
        ))}
      </ul>
    </aside>}

    <div className="kiosk-live-feed">
      <div className="kiosk-feed-head">
        <div>
          <span className="eyebrow" style={{ color: 'var(--lime)', letterSpacing: '0.1em' }}>LIVE FEED</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700 }}>Recent Biometric Punch Events</h3>
        </div>
        <span className="live-pulse-badge">
          <span className="pulse-dot" /> Auto-syncing · Latest 5
        </span>
      </div>

      {overview?.events?.length ? (
        <div className="table-scroll">
          <table className="kiosk-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Punch Direction</th>
                <th>Session</th>
                <th>Timestamp</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {overview.events.slice(0, 5).map(event => {
                const hour = new Date(event.timestamp).getHours();
                const session = hour < 12 ? 'morning' : hour < 16 ? 'afternoon' : 'evening';
                const isCheckIn = event.action === 'checkin';
                const memberName = event.member?.fullName || 'Member';
                const initials = event.member?.avatarInitials || memberName.split(' ').map(p => p[0]).join('').slice(0, 2);
                return (
                  <tr key={event.id}>
                    <td>
                      <div className="attendance-member-cell">
                        <span className="attendance-avatar">{initials}</span>
                        <div>
                          <b>{memberName}</b>
                          <small>{event.member?.memberId || 'GYM-ID'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`kiosk-punch-pill ${isCheckIn ? 'checkin' : 'checkout'}`}>
                        {isCheckIn ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                        {isCheckIn ? 'CHECK IN' : 'CHECK OUT'}
                      </span>
                    </td>
                    <td>
                      <span className={`session-badge ${session}`}>
                        {session}
                      </span>
                    </td>
                    <td>
                      <div className="attendance-time-cell">
                        <b>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b>
                        <small>{new Date(event.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</small>
                      </div>
                    </td>
                    <td>
                      <span className="kiosk-verified-tag">
                        <ShieldCheck size={13} color="var(--lime)" /> Biometric Punch
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>No recent attendance events logged.</p>
      )}
    </div>
  </section>;
}
