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
  CreditCard,
  ArrowRight,
  Calendar,
} from 'lucide-react';

const formatDate = (dateVal) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateVal);
  }
};

export default function AttendancePopup({ popup, onClose }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!popup) return;
    const isSpecial = popup.action === 'expired' || Boolean(popup.membership || popup.errorData?.membership);
    const duration = isSpecial ? 7000 : 4000; // 7s for expired membership gives ample time to read plan & dates
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [popup]);

  if (!popup) return null;

  const isSuccess = popup.type === 'success';
  const isWarning = popup.type === 'warning';
  const isInfo = popup.type === 'info';
  const modalTypeClass = isSuccess ? 'success' : isWarning ? 'warning' : isInfo ? 'info' : 'error';
  const member = popup.member || popup.errorData?.member;
  const membership = popup.membership || popup.errorData?.membership || member?.membership;
  const hasPhoto = Boolean(member?.profilePicture);
  const isExpired = popup.action === 'expired' || membership?.status === 'expired' || Boolean(membership);

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
                  {(isExpired || popup.action === 'expired') && (
                    <span
                      className="kiosk-punch-pill expired"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertTriangle size={11} /> PLAN EXPIRED
                    </span>
                  )}
                  {popup.action && !['duplicate', 'expired', 'ineligible'].includes(popup.action) && (
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

          {membership && (
            <div className="attendance-popup-plan-card">
              <div className="attendance-popup-plan-header">
                <div className="attendance-popup-plan-title">
                  <CreditCard size={15} className="plan-icon" />
                  <span>{membership.planName || 'Membership Plan'}</span>
                </div>
                <span className="attendance-popup-plan-status expired">
                  EXPIRED
                </span>
              </div>
              <div className="attendance-popup-plan-dates">
                <div className="plan-date-col">
                  <span className="plan-date-label">Plan From Date</span>
                  <strong className="plan-date-val">
                    {formatDate(membership.startDate)}
                  </strong>
                </div>
                <div className="plan-date-divider">
                  <ArrowRight size={14} />
                </div>
                <div className="plan-date-col">
                  <span className="plan-date-label">Ended Date</span>
                  <strong className="plan-date-val expired">
                    {formatDate(membership.endDate)}
                  </strong>
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
