import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { createMorFinAuth } from '../services/morfinAuth.mjs';
import { assertNoDuplicateCapture } from '../utils/biometricDuplicateCheck';

const fingers = [
  'right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little',
  'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little'
];
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
      .then(r => setCapability(r.data.data))
      .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (own) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get('/members', { params: { search, limit: 100, biometricStatus: 'unenrolled' }, signal: controller.signal })
        .then(r => setMembers(r.data.data.members))
        .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, own]);

  useEffect(() => {
    setCapture(null);
    setEnrollment(null);
    setReplace(false);
    setDeleteConfirm(false);
    setMessage('');
    setError('');
    if (!memberId) return;

    const controller = new AbortController();
    api.get('/biometrics/enrollment', { params: { memberId }, signal: controller.signal })
      .then(r => setEnrollment(r.data.data.enrollment))
      .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [memberId]);

  async function run(task) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await task(controller.signal);
    } catch (e) {
      if (alive.current && !controller.signal.aborted) setError(errorText(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (alive.current) setBusy(false);
    }
  }

  function localAdapter() {
    if (!adapter.current) {
      adapter.current = createMorFinAuth({
        baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth',
      });
    }
    return adapter.current;
  }

  const scan = () => run(async signal => {
    setCapture(null);
    await api.post('/biometrics/enroll/initialize', { memberId }, { signal });
    const data = await localAdapter().capture({ signal });
    if (signal.aborted || !alive.current) return;
    setMessage('Checking for duplicate fingerprints across profiles...');
    await assertNoDuplicateCapture({ adapter: localAdapter(), captureData: data, targetMemberId: memberId, signal });
    if (!signal.aborted && alive.current) {
      setCapture(data);
      setMessage('Capture verified (unique fingerprint). Review scan quality and click "Save enrollment".');
    }
  });

  const save = () => run(async signal => {
    const result = await api.post('/biometrics/enroll/process', {
      memberId,
      fingerPosition: finger,
      captureData: capture,
      ...(replace && enrollment ? { replaceEnrollmentReference: enrollment.enrollmentReference } : {}),
    }, { signal });
    if (!signal.aborted && alive.current) {
      if (!own) {
        setMembers(prev => prev.filter(m => m._id !== memberId));
        setMemberId('');
        setEnrollment(null);
        setCapture(null);
        setReplace(false);
        setMessage('Fingerprint enrolled! Member removed from the pending list (edit later in Members section if needed).');
      } else {
        setEnrollment(result.data.data);
        setCapture(null);
        setReplace(false);
        setMessage('Fingerprint enrolled successfully.');
      }
    }
  });

  const remove = () => run(async signal => {
    await api.delete('/biometrics/enrollment', { data: { memberId }, signal });
    if (!signal.aborted && alive.current) {
      setEnrollment(null);
      setCapture(null);
      setDeleteConfirm(false);
      setMessage('Fingerprint enrollment deleted.');
    }
  });

  return (
    <div className="dash-content operations biometric-page">
      <div className="attendance-kiosk-notice-banner biometric-notice-banner">
        <div className="kiosk-notice-info">
          <div className="kiosk-notice-pill">
            <Fingerprint size={16} />
            <span>MFS500 HARDWARE WORKSTATION ACTIVE</span>
          </div>
          <h3>Biometric Fingerprint Enrollment</h3>
          <p>
            {own
              ? 'View or register your biometric fingerprint for studio turnstile touchless access.'
              : 'Enroll biometric fingerprints for pending members with the Mantra MFS500 optical reader. Once enrolled, members automatically qualify for turnstile punch entry.'}
          </p>
        </div>
      </div>

      <section className="table-card biometric-luxury-card">
        <div className="biometric-card-header">
          <div className="biometric-header-badge">
            <Fingerprint size={20} className="kiosk-icon-glow" />
            <div>
              <h3>Provision Biometric Credential</h3>
              <p>
                {own
                  ? 'Select finger position and capture your live biometric fingerprint.'
                  : 'Fast-track member provisioning. Choose an un-enrolled member, select the finger, and capture on scanner.'}
              </p>
            </div>
          </div>
        </div>

        {!own && (
          <div className="biometric-member-picker-grid">
            <label className="biometric-field">
              <span className="field-label-tag">SEARCH PENDING MEMBER</span>
              <input
                value={search}
                disabled={busy}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, or Member ID…"
                className="luxury-input"
              />
            </label>
            <label className="biometric-field">
              <span className="field-label-tag">SELECT UN-ENROLLED MEMBER</span>
              <select
                value={memberId}
                disabled={busy}
                onChange={e => setMemberId(e.target.value)}
                className="luxury-select"
              >
                <option value="">Choose pending member ({members.length} available)</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.memberId} — {m.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="biometric-finger-row">
          <label className="biometric-field finger-select-field">
            <span className="field-label-tag">FINGER POSITION</span>
            <select
              value={finger}
              disabled={busy}
              onChange={e => { setFinger(e.target.value); setCapture(null); }}
              className="luxury-select"
            >
              {fingers.map(f => (
                <option key={f} value={f}>
                  {f.replaceAll('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        {enrollment && (
          <div className="biometric-active-enrollment-card">
            <div className="active-enrollment-badge">
              <CheckCircle2 size={16} />
              <span>ACTIVE FINGERPRINT ENROLLED</span>
            </div>
            <p className="active-enrollment-meta">
              Position: <strong>{enrollment.fingerPosition?.replaceAll('_', ' ').toUpperCase() || 'RIGHT INDEX'}</strong>
              <span className="meta-sep">•</span>
              Enrolled: {new Date(enrollment.enrollmentDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {!own && (
              <p className="active-enrollment-hint">
                Already enrolled. To edit or replace this fingerprint, open the <strong>Members</strong> module and use the fingerprint action.
              </p>
            )}
          </div>
        )}

        {capability && !capability.enrollmentStorage && (
          <p role="status" className="alert-warning biometric-alert">
            Enrollment storage requires a backend encryption key before biometric captures can be securely saved.
          </p>
        )}

        <div className="biometric-action-toolbar">
          <button
            className="lime-btn biometric-scan-btn"
            disabled={busy || !memberId || !capability?.enrollmentStorage || (!!enrollment && !replace)}
            onClick={scan}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Fingerprint size={16} />}
            <span>{capture ? 'Scan Again' : 'Capture Fingerprint'}</span>
          </button>
          {capture && (
            <button
              className="outline-btn"
              onClick={() => { setCapture(null); setMessage(''); }}
            >
              Clear Capture
            </button>
          )}
        </div>

        {capture && (
          <div className="biometric-capture-card">
            <div className="biometric-preview-canvas">
              <img src={'data:image/bmp;base64,' + capture.imageBase64} alt="Captured fingerprint preview" />
            </div>
            <div className="biometric-capture-details">
              <div className="quality-meter-head">
                <span>Scan Quality</span>
                <strong>{capture.quality}/100</strong>
              </div>
              <div className="quality-progress-track">
                <div
                  className={`quality-progress-bar ${capture.quality >= 60 ? 'good' : 'warning'}`}
                  style={{ width: `${Math.min(100, Math.max(10, capture.quality))}%` }}
                />
              </div>
              <p className="capture-subtext">
                Optical Device: {capture.deviceModel || 'MFS500'} • ANSI/NIST template generated
              </p>
              <button className="lime-btn save-capture-btn" disabled={busy} onClick={save}>
                <CheckCircle2 size={16} /> Save Biometric Enrollment
              </button>
            </div>
          </div>
        )}

        {enrollment && own && (
          <div className="biometric-danger-zone">
            {deleteConfirm ? (
              <div className="delete-confirm-box">
                <span className="delete-warn-text">Delete this fingerprint enrollment?</span>
                <button className="outline-btn btn-destructive" disabled={busy} onClick={remove}>
                  Confirm Deletion
                </button>
                <button className="ghost-btn" disabled={busy} onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="outline-btn btn-destructive" disabled={busy} onClick={() => setDeleteConfirm(true)}>
                Delete Fingerprint
              </button>
            )}
          </div>
        )}

        {message && <div className="alert-success biometric-alert-box">{message}</div>}
        {error && <div className="alert-error biometric-alert-box">{error}</div>}
      </section>
    </div>
  );
}
