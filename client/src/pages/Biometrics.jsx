import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { createMorFinAuth } from '../services/morfinAuth.mjs';

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
      api.get('/members', { params: { search, limit: 100 }, signal: controller.signal })
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
    if (!signal.aborted && alive.current) {
      setCapture(data);
      setMessage('Capture successful. Review scan quality and click "Save enrollment".');
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
      setEnrollment(result.data.data);
      setCapture(null);
      setReplace(false);
      setMessage('Fingerprint enrolled successfully.');
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
      <section className="table-card biometric-card">
        <div style={{ marginBottom: '8px' }}>
          <h2><Fingerprint aria-hidden="true" /> Fingerprint Enrollment</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            Register or update a member's biometric fingerprint for studio entry.
          </p>
        </div>

        {!own && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', maxWidth: '640px' }}>
            <label>
              <span>Search member</span>
              <input
                value={search}
                disabled={busy}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, or ID…"
              />
            </label>
            <label>
              <span>Select member</span>
              <select
                value={memberId}
                disabled={busy}
                onChange={e => setMemberId(e.target.value)}
              >
                <option value="">Choose member ({members.length} found)</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.memberId} — {m.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label style={{ maxWidth: '320px' }}>
          <span>Finger position</span>
          <select
            value={finger}
            disabled={busy}
            onChange={e => { setFinger(e.target.value); setCapture(null); }}
          >
            {fingers.map(f => (
              <option key={f} value={f}>
                {f.replaceAll('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {enrollment && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '10px',
            padding: '14px 18px',
            maxWidth: '560px',
            margin: '4px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px' }}>
              <CheckCircle2 size={16} /> Active Fingerprint Enrolled
            </div>
            <p style={{ margin: '6px 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Finger: <strong>{enrollment.fingerPosition?.replaceAll('_', ' ').toUpperCase() || 'RIGHT INDEX'}</strong>
              {' • '}
              Enrolled: {new Date(enrollment.enrollmentDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <label className="biometric-check" style={{ fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={busy}
                checked={replace}
                onChange={e => { setReplace(e.target.checked); setCapture(null); }}
              />
              Replace this saved fingerprint
            </label>
          </div>
        )}

        {capability && !capability.enrollmentStorage && (
          <p role="status" className="alert-warning" style={{ padding: '10px 14px', borderRadius: '8px', maxWidth: '560px' }}>
            Enrollment storage needs a backend encryption key before captures can be saved.
          </p>
        )}

        <div className="biometric-actions">
          <button
            className="lime-btn"
            disabled={busy || !memberId || !capability?.enrollmentStorage || (!!enrollment && !replace)}
            onClick={scan}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Fingerprint size={16} />}
            {capture ? 'Scan again' : 'Capture fingerprint'}
          </button>
          {capture && (
            <button
              className="ghost-btn"
              onClick={() => { setCapture(null); setMessage(''); }}
            >
              Clear capture
            </button>
          )}
        </div>

        {capture && (
          <div className="biometric-preview" style={{ maxWidth: '560px' }}>
            <img src={'data:image/bmp;base64,' + capture.imageBase64} alt="Captured fingerprint preview" />
            <div>
              <p><strong>Scan Quality: {capture.quality}/100</strong></p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Device: {capture.deviceModel || 'MFS500'} • Encrypted template ready
              </p>
              <button className="lime-btn" disabled={busy} onClick={save}>
                Save enrollment
              </button>
            </div>
          </div>
        )}

        {enrollment && (own || user.role === 'admin') && (
          <div className="biometric-actions" style={{ marginTop: '6px' }}>
            {deleteConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--alert-error-text)', fontSize: '13px' }}>Delete this fingerprint?</span>
                <button className="outline-btn btn-destructive" disabled={busy} onClick={remove}>
                  Confirm deletion
                </button>
                <button className="ghost-btn" disabled={busy} onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="outline-btn btn-destructive" disabled={busy} onClick={() => setDeleteConfirm(true)}>
                Delete fingerprint
              </button>
            )}
          </div>
        )}

        {message && <div className="alert-success" style={{ margin: '10px 0 0', maxWidth: '560px' }}>{message}</div>}
        {error && <div className="alert-error" style={{ margin: '10px 0 0', maxWidth: '560px' }}>{error}</div>}
      </section>
    </div>
  );
}
