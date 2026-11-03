import { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
} from 'lucide-react';

export default function AttendancePopup({ popup, onClose }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, 4000); // 4s auto-dismiss allows comfortable view of member photo and error/success message
    return () => clearTimeout(timer);
  }, [popup]);

  if (!popup) return null;

  const isSuccess = popup.type === 'success';
  const isWarning = popup.type === 'warning';
  const isInfo = popup.type === 'info';
  const modalTypeClass = isSuccess ? 'success' : isWarning ? 'warning' : isInfo ? 'info' : 'error';
  const member = popup.member;
  const hasPhoto = Boolean(member?.profilePicture);

  return (
    <div className="attendance-popup-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`attendance-popup-modal ${modalTypeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="attendance-popup-close" onClick={onClose} aria-label="Close message">
          <X size={15} />
        </button>

        <div className={`attendance-popup-icon-wrap ${modalTypeClass}`}>
          {isSuccess ? (
            <CheckCircle2 size={32} color="var(--lime, #C6FF00)" strokeWidth={2.4} />
          ) : isWarning ? (
            <AlertTriangle size={32} color="#f59e0b" strokeWidth={2.4} />
          ) : isInfo ? (
            <Info size={32} color="#3b82f6" strokeWidth={2.4} />
          ) : (
            <AlertCircle size={32} color="#ff4d4f" strokeWidth={2.4} />
          )}
        </div>

        <div className="attendance-popup-content">
          <h2 className="attendance-popup-title">
            {popup.title || (isSuccess ? 'Thank you! Attendance marked' : 'Attendance Notice')}
          </h2>

          <p className="attendance-popup-subtitle">
            {popup.subtitle ||
              (isSuccess
                ? 'Your visit has been recorded successfully.'
                : 'Please scan your finger again.')}
          </p>

          {member && (
            <div className="attendance-popup-member-card">
              <div className="attendance-popup-avatar-container">
                {hasPhoto ? (
                  <img
                    src={member.profilePicture}
                    alt={member.fullName || 'Member'}
                    className="attendance-popup-avatar-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.attendance-avatar');
                      if (fallback) fallback.style.display = 'grid';
                    }}
                  />
                ) : null}
                <span
                  className="attendance-avatar"
                  style={{ display: hasPhoto ? 'none' : 'grid' }}
                >
                  {member.avatarInitials || member.fullName?.slice(0, 2).toUpperCase() || 'VF'}
                </span>
              </div>
              <div className="attendance-popup-member-info">
                <div className="attendance-popup-member-name-row">
                  <b>{member.fullName || 'Member'}</b>
                  {member.memberId && <span className="attendance-member-code">{member.memberId}</span>}
                </div>
                <div className="attendance-popup-tags">
                  {popup.action && popup.action !== 'duplicate' && (
                    <span
                      className={`kiosk-punch-pill ${
                        popup.action.toLowerCase().includes('in') ? 'checkin' : 'checkout'
                      }`}
                    >
                      {popup.action.toLowerCase().includes('in') ? (
                        <ArrowDownRight size={12} />
                      ) : (
                        <ArrowUpRight size={12} />
                      )}
                      {popup.action.toUpperCase()}
                    </span>
                  )}
                  {popup.action === 'duplicate' && (
                    <span
                      className="kiosk-punch-pill"
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      ALREADY RECORDED
                    </span>
                  )}
                  {popup.sessionName && (
                    <span className={`session-badge ${popup.sessionName.toLowerCase()}`}>
                      {popup.sessionName}
                    </span>
                  )}
                  {popup.duration && (
                    <span className="attendance-duration-pill done">{popup.duration}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isSuccess && popup.dailySpending?.totalHoursFormatted && (
            <div className="attendance-popup-spending">
              <Flame size={13} color="var(--lime, #C6FF00)" />
              <span>
                Today's Total Gym Time: <strong>{popup.dailySpending.totalHoursFormatted}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
