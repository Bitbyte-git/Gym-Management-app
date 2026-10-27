import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, ArrowDownRight, ArrowUpRight, Flame } from 'lucide-react';

export default function AttendancePopup({ popup, onClose }) {
  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2000); // Silent auto-dismiss after exactly 2 seconds
    return () => clearTimeout(timer);
  }, [popup?.id, onClose]);

  if (!popup) return null;

  const isSuccess = popup.type === 'success';

  return (
    <div className="attendance-popup-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`attendance-popup-modal ${isSuccess ? 'success' : 'error'}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="attendance-popup-close" onClick={onClose} aria-label="Close message">
          <X size={15} />
        </button>

        <div className={`attendance-popup-icon-wrap ${isSuccess ? 'success' : 'error'}`}>
          {isSuccess ? (
            <CheckCircle2 size={32} color="var(--lime)" strokeWidth={2.4} />
          ) : (
            <AlertCircle size={32} color="#ff4d4f" strokeWidth={2.4} />
          )}
        </div>

        <div className="attendance-popup-content">
          <h2 className="attendance-popup-title">
            {popup.title || (isSuccess ? 'Thank you! Attendance marked' : 'Try again, not Matched')}
          </h2>

          <p className="attendance-popup-subtitle">
            {popup.subtitle || (isSuccess ? 'Your visit has been recorded successfully.' : 'Fingerprint not recognized. Please scan your finger again.')}
          </p>

          {isSuccess && popup.member && (
            <div className="attendance-popup-member-card">
              <span className="attendance-avatar">
                {popup.member.avatarInitials || popup.member.fullName?.slice(0, 2).toUpperCase() || 'VF'}
              </span>
              <div className="attendance-popup-member-info">
                <b>{popup.member.fullName || 'Member'}</b>
                <div className="attendance-popup-tags">
                  {popup.action && (
                    <span className={`kiosk-punch-pill ${popup.action.toLowerCase().includes('in') ? 'checkin' : 'checkout'}`}>
                      {popup.action.toLowerCase().includes('in') ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                      {popup.action.toUpperCase()}
                    </span>
                  )}
                  {popup.sessionName && (
                    <span className={`session-badge ${popup.sessionName.toLowerCase()}`}>
                      {popup.sessionName}
                    </span>
                  )}
                  {popup.duration && (
                    <span className="attendance-duration-pill done">
                      {popup.duration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isSuccess && popup.dailySpending?.totalHoursFormatted && (
            <div className="attendance-popup-spending">
              <Flame size={13} color="var(--lime)" />
              <span>Today's Total Gym Time: <strong>{popup.dailySpending.totalHoursFormatted}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
