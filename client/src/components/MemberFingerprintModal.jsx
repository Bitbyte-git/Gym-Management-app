import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, X, Trash2 } from 'lucide-react';
import api from '../services/api';
import { createMorFinAuth } from '../services/morfinAuth.mjs';
import { assertNoDuplicateCapture } from '../utils/biometricDuplicateCheck';

const fingers = [
  'right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little',
  'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little'
];

const errorText = e => e.response?.data?.error || e.message || 'Biometric operation failed';

export default function MemberFingerprintModal({ member, user, onClose, onUpdated }) {
  const [finger, setFinger] = useState('right_index');
  const [capture, setCapture] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [capability, setCapability] = useState(null);
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
    setLoadingStatus(true);
    Promise.all([
      api.get('/biometrics/status', { signal: controller.signal }),
      api.get('/biometrics/enrollment', { params: { memberId: member._id }, signal: controller.signal }),
    ])
      .then(([capRes, enrRes]) => {
        if (!alive.current) return;
        setCapability(capRes.data.data);
        const enr = enrRes.data.data?.enrollment || null;
        setEnrollment(enr);
        if (enr?.fingerPosition) setFinger(enr.fingerPosition);
      })
      .catch(e => { if (!controller.signal.aborted && alive.current) setError(errorText(e)); })
      .finally(() => { if (alive.current) setLoadingStatus(false); });
    return () => controller.abort();
  }, [member._id]);

  function localAdapter() {
    if (!adapter.current) {
      adapter.current = createMorFinAuth({
        baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth',
      });
    }
    return adapter.current;
  }

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

  const scan = () => run(async signal => {
    setCapture(null);
    await api.post('/biometrics/enroll/initialize', { memberId: member._id }, { signal });
    const data = await localAdapter().capture({ signal });
    if (signal.aborted || !alive.current) return;
    setMessage('Checking for duplicate fingerprints across profiles...');
    await assertNoDuplicateCapture({ adapter: localAdapter(), captureData: data, targetMemberId: member._id, signal });
    if (!signal.aborted && alive.current) {
      setCapture(data);
      setMessage('Capture verified (unique fingerprint). Review scan quality and click "Save fingerprint".');
    }
  });

  const save = () => run(async signal => {
    const result = await api.post('/biometrics/enroll/process', {
      memberId: member._id,
      fingerPosition: finger,
      captureData: capture,
      ...(enrollment ? { replaceEnrollmentReference: enrollment.enrollmentReference } : {}),
    }, { signal });
    if (!signal.aborted && alive.current) {
      setEnrollment(result.data.data);
      setCapture(null);
      setMessage(enrollment ? 'Fingerprint updated successfully.' : 'Fingerprint enrolled successfully.');
      onUpdated?.();
    }
  });

  const remove = () => run(async signal => {
    await api.delete('/biometrics/enrollment', { data: { memberId: member._id }, signal });
    if (!signal.aborted && alive.current) {
      setEnrollment(null);
      setCapture(null);
      setDeleteConfirm(false);
      setMessage('Fingerprint enrollment deleted.');
      onUpdated?.();
    }
  });

  return (
    <div className="operation-modal" role="dialog" aria-modal="true" aria-label={`Manage fingerprint for ${member.fullName}`}>
      <div className="registration-form operation-form" style={{ maxWidth: '580px', width: '100%', position: 'relative' }}>
        <button
          type="button"
          className="member-modal-close"
          onClick={onClose}
          aria-label="Close fingerprint modal"
          style={{ top: 18, right: 18 }}
        >
          <X size={18} />
        </button>

        <div className="operation-form-head">
          <div>
            <span>MEMBER BIOMETRICS</span>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fingerprint size={22} color="var(--color-primary)" />
              {enrollment ? 'Edit / Replace Fingerprint' : 'Add Fingerprint'}
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {member.fullName} ({member.memberId})
          </p>
        </div>

        {loadingStatus ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={18} className="animate-spin" /> Checking biometric enrollment status...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {enrollment ? (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '10px',
                padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px' }}>
                  <CheckCircle2 size={16} /> Active Fingerprint Enrolled
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Finger: <strong>{enrollment.fingerPosition?.replaceAll('_', ' ').toUpperCase() || 'RIGHT INDEX'}</strong>
                  {' • '}
                  Enrolled: {new Date(enrollment.enrollmentDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                No fingerprint enrolled for this member yet.
              </p>
            )}

            <label>
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

            {capability && !capability.enrollmentStorage && (
              <p role="status" className="alert-warning" style={{ padding: '10px 14px', borderRadius: '8px', margin: 0 }}>
                Enrollment storage needs a backend encryption key before captures can be saved.
              </p>
            )}

            <div className="biometric-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="lime-btn"
                disabled={busy || !capability?.enrollmentStorage}
                onClick={scan}
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Fingerprint size={16} />}
                {capture ? 'Scan again' : enrollment ? 'Scan new fingerprint to replace' : 'Capture fingerprint'}
              </button>
              {capture && (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={busy}
                  onClick={() => { setCapture(null); setMessage(''); }}
                >
                  Clear capture
                </button>
              )}
            </div>

            {capture && (
              <div className="biometric-preview">
                <img src={'data:image/bmp;base64,' + capture.imageBase64} alt="Captured fingerprint preview" />
                <div>
                  <p><strong>Scan Quality: {capture.quality}/100</strong></p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Device: {capture.deviceModel || 'MFS500'} • Unique template verified
                  </p>
                  <button type="button" className="lime-btn" disabled={busy} onClick={save}>
                    {enrollment ? 'Replace & save fingerprint' : 'Save fingerprint'}
                  </button>
                </div>
              </div>
            )}

            {enrollment && user?.role === 'admin' && (
              <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '12px', marginTop: '4px' }}>
                {deleteConfirm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--alert-error-text)', fontSize: '13px' }}>Delete this fingerprint?</span>
                    <button type="button" className="outline-btn btn-destructive" disabled={busy} onClick={remove}>
                      Confirm deletion
                    </button>
                    <button type="button" className="ghost-btn" disabled={busy} onClick={() => setDeleteConfirm(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className="outline-btn btn-destructive" disabled={busy} onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={14} /> Delete fingerprint
                  </button>
                )}
              </div>
            )}

            {message && <div className="alert-success" style={{ margin: 0 }}>{message}</div>}
            {error && <div className="alert-error" style={{ margin: 0 }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

