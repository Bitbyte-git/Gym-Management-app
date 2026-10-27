import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { createMorFinAuth } from '../services/morfinAuth.mjs';

const fingers = ['right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little', 'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little'];
const errorText = e => e.response?.data?.error || e.message || 'Biometric operation failed';
export default function Biometrics({ user }) {
  const own = user.role === 'member';
  const [memberId, setMemberId] = useState(own ? user.profile?._id || '' : '');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [finger, setFinger] = useState('right_index');
  const [capture, setCapture] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [capability, setCapability] = useState(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [clientKey, setClientKey] = useState('');
  const [testGallery, setTestGallery] = useState(null);
  const diagnosticsEnabled = import.meta.env.DEV && user.role === 'admin';
  const operation = useRef(null);
  const alive = useRef(true);
  const adapter = useRef(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; operation.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/biometrics/status', { signal: controller.signal })
      .then(r => setCapability(r.data.data)).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (own) return;
    const controller = new AbortController();
    const timer = setTimeout(() => api.get('/members', { params: { search, limit: 100 }, signal: controller.signal })
      .then(r => setMembers(r.data.data.members)).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); }), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, own]);
  useEffect(() => {
    setCapture(null); setTestGallery(null); setEnrollment(null); setReplace(false); setDeleteConfirm(false); setMessage(''); setError('');
    if (!memberId) return;
    const controller = new AbortController();
    api.get('/biometrics/enrollment', { params: { memberId }, signal: controller.signal })
      .then(r => setEnrollment(r.data.data.enrollment)).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [memberId]);

  async function run(task) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller; setBusy(true); setMessage(''); setError('');
    try { await task(controller.signal); }
    catch (e) { if (alive.current && !controller.signal.aborted) setError(errorText(e)); }
    finally { if (operation.current === controller) operation.current = null; if (alive.current) setBusy(false); }
  }
  function localAdapter() {
    if ((import.meta.env.VITE_MANTRA_DEVICE_MODEL || 'MFS500') !== 'MFS500') throw new Error('Configure the scanner model as MFS500');
    if (!adapter.current) adapter.current = createMorFinAuth({ baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth' });
    return adapter.current;
  }
  const check = () => run(async signal => {
    const { devices } = await localAdapter().availability({ signal });
    if (!devices.includes('MFS500')) throw new Error('MFS500 is disconnected');
    if (!signal.aborted) setMessage('MorFinAuth is available. MFS500 is connected.');
  });
  const scan = () => run(async signal => {
    setCapture(null);
    await api.post('/biometrics/enroll/initialize', { memberId }, { signal });
    const data = await localAdapter().capture({ signal, clientKey });
    if (!signal.aborted && alive.current) { setCapture(data); setMessage('Capture ready. Review quality and save, or retry.'); }
  });
  const save = () => run(async signal => {
    const result = await api.post('/biometrics/enroll/process', {
      memberId, fingerPosition: finger, captureData: capture,
      ...(replace && enrollment ? { replaceEnrollmentReference: enrollment.enrollmentReference } : {}),
    }, { signal });
    if (!signal.aborted && alive.current) { setEnrollment(result.data.data); setCapture(null); setReplace(false); setMessage('Enrollment saved securely.'); }
  });
  const captureTestGallery = () => run(async signal => {
    setTestGallery(null);
    const testCapture = await localAdapter().capture({ signal, clientKey });
    if (!signal.aborted && alive.current) { setTestGallery(testCapture.templateBase64); setMessage('Temporary test gallery captured in memory.'); }
  });
  const testVerify = () => run(async signal => {
    const probe = await localAdapter().capture({ signal, clientKey });
    const result = await localAdapter().verify({ probeTemplate: probe.templateBase64, galleryTemplate: testGallery, signal, clientKey });
    if (!signal.aborted && alive.current) setMessage(result.matched ? 'Local diagnostic: vendor reported a match. No attendance recorded.' : 'Local diagnostic: fingerprints did not match. No attendance recorded.');
  });
  const testMatch = () => run(async signal => {
    const result = await localAdapter().match({ galleryTemplate: testGallery, signal, clientKey });
    if (!signal.aborted && alive.current) setMessage(result.matched ? 'Local diagnostic: vendor reported a match. No attendance recorded.' : 'Local diagnostic: fingerprints did not match. No attendance recorded.');
  });
  const remove = () => run(async signal => {
    await api.delete('/biometrics/enrollment', { data: { memberId }, signal });
    if (!signal.aborted && alive.current) { setEnrollment(null); setCapture(null); setDeleteConfirm(false); setMessage('Enrollment deleted.'); }
  });
  return <div className="dash-content operations biometric-page">
    <section className="table-card biometric-card">
      <h2><Fingerprint aria-hidden="true" /> Fingerprint enrollment</h2>
      <p>Select a member and finger, then capture and review before saving.</p>
      {!own && <label>Find member<input value={search} disabled={busy} onChange={e => setSearch(e.target.value)} placeholder="Name or member ID" /></label>}
      {!own && <label>Member<select value={memberId} disabled={busy} onChange={e => setMemberId(e.target.value)}><option value="">Select member</option>{members.map(m => <option key={m._id} value={m._id}>{m.memberId} | {m.fullName}</option>)}</select></label>}
      <label>Workstation SDK client key (if required by Mantra)<input type="password" autoComplete="off" value={clientKey} disabled={busy} onChange={e => { setClientKey(e.target.value); setCapture(null); setTestGallery(null); }} /></label>
      <label>Finger<select value={finger} disabled={busy} onChange={e => { setFinger(e.target.value); setCapture(null); }}>{fingers.map(f => <option key={f} value={f}>{f.replaceAll('_', ' ')}</option>)}</select></label>
      {enrollment && <p>Saved enrollment: {enrollment.fingerPosition?.replaceAll('_', ' ') || 'Legacy enrollment'} | {enrollment.enrollmentStatus} | {new Date(enrollment.enrollmentDate).toLocaleString()}
        <br />{enrollment.deviceModel} {enrollment.deviceSerial}</p>}
      {enrollment && <label className="biometric-check"><input type="checkbox" disabled={busy} checked={replace} onChange={e => { setReplace(e.target.checked); setCapture(null); }} /> Replace this saved enrollment</label>}
      {capability && !capability.enrollmentStorage && <p role="status">Enrollment storage needs a backend encryption key before captures can be saved.</p>}
      <div className="biometric-actions">
        <button className="outline-btn" disabled={busy} onClick={check}>Check scanner</button>
        <button className="lime-btn" disabled={busy || !memberId || !capability?.enrollmentStorage || (!!enrollment && !replace)} onClick={scan}>{busy ? <Loader2 className="animate-spin" /> : <Fingerprint />} {capture ? 'Retry capture' : 'Capture fingerprint'}</button>
        <button className="ghost-btn" onClick={() => { operation.current?.abort(); setCapture(null); setTestGallery(null); setClientKey(''); setMessage('Capture cleared. A save already received by the server may have completed; reload the enrollment status.'); }}>Cancel / clear capture</button>
      </div>
      {capture && <div className="biometric-preview"><img src={'data:image/bmp;base64,' + capture.imageBase64} alt="Captured fingerprint preview" /><p>Quality: {capture.quality}/100{capture.nfiq !== undefined && <> | NFIQ: {capture.nfiq}</>}<br />{capture.deviceModel} | {capture.deviceSerial}<br />{capability?.retainImages ? 'Template and image will be encrypted and retained.' : 'Only the encrypted template will be retained; this preview is temporary.'}</p><button className="lime-btn" disabled={busy} onClick={save}>Save enrollment</button></div>}
      {enrollment && (own || user.role === 'admin') && <div className="biometric-actions">{deleteConfirm ? <><span>Delete the saved fingerprint and retained image?</span><button className="outline-btn" disabled={busy} onClick={remove}>Confirm deletion</button><button className="ghost-btn" disabled={busy} onClick={() => setDeleteConfirm(false)}>Keep enrollment</button></> : <button className="outline-btn" disabled={busy} onClick={() => setDeleteConfirm(true)}>Delete enrollment</button>}</div>}
      {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    </section>
    {diagnosticsEnabled && <section className="table-card biometric-card"><h2>Development matching diagnostics</h2><p>Capture a temporary test gallery, then scan the same finger or a different finger. Nothing in this diagnostic is saved or sent to the attendance API.</p><div className="biometric-actions"><button className="outline-btn" disabled={busy} onClick={captureTestGallery}>Capture test gallery</button><button className="outline-btn" disabled={busy || !testGallery} onClick={testVerify}>Capture probe and verify</button><button className="outline-btn" disabled={busy || !testGallery} onClick={testMatch}>Live match</button><button className="ghost-btn" disabled={busy} onClick={() => { setTestGallery(null); setClientKey(''); setMessage('Diagnostic data cleared.'); }}>Clear diagnostic data</button></div></section>}
    <section className="table-card biometric-card"><h2>Biometric attendance</h2><p>{capability?.message || 'Checking verification capability...'}</p><p>Reception manages check-in and check-out in the attendance screen.</p>{capability?.identificationAvailable && ['admin', 'reception'].includes(user.role) && <Link className="outline-btn" to={'/' + user.role + '/attendance'}>Open attendance</Link>}</section>
  </div>;
}
