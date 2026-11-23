import { useState, useEffect } from 'react';
import {
  CreditCard,
  CalendarDays,
  ArrowRight,
  X,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UserRound,
  Phone,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import api from '../services/api';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(val);
  }
};

const initials = (name) =>
  String(name || 'Member')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export default function MemberPlanModal({ member, onClose, onViewFullProfile }) {
  const [membership, setMembership] = useState(member?.latestMembership || null);
  const [loading, setLoading] = useState(!member?.latestMembership);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member?.latestMembership) {
      setMembership(member.latestMembership);
      setLoading(false);
      return;
    }
    const memberId = member?._id || member?.id;
    if (!memberId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    api
      .get(`/memberships/history/${memberId}`)
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data || [];
        setMembership(list[0] || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Unable to load membership plan');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [member?._id, member?.id, member?.latestMembership]);

  const now = new Date();
  const endDate = membership?.endDate ? new Date(membership.endDate) : null;
  const isExpired = membership
    ? membership.status === 'expired' || (endDate && endDate < now)
    : false;

  let daysInfo = '';
  if (endDate && !isNaN(endDate.getTime())) {
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      daysInfo = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
    } else if (diffDays === 0) {
      daysInfo = 'Expires today';
    } else {
      daysInfo = `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
    }
  }

  const planName =
    membership?.membershipPlan?.name || membership?.planName || 'Membership Plan';
  const planDuration = membership?.membershipPlan?.duration
    ? `${membership.membershipPlan.duration} ${
        membership.membershipPlan.durationUnit || 'Months'
      }`
    : '';

  return (
    <div
      className="member-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${member.fullName} Latest Membership Plan`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article className="member-plan-quick-modal">
        {/* Header */}
        <header className="member-plan-quick-header">
          <button
            className="member-modal-close"
            onClick={onClose}
            aria-label="Close plan details"
          >
            <X size={18} />
          </button>
          <div className="member-plan-quick-hero">
            <div className="member-plan-avatar">
              {member.profilePicture ? (
                <img
                  src={member.profilePicture}
                  alt={member.fullName}
                  className="member-plan-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'grid';
                    }
                  }}
                />
              ) : null}
              <div
                className="member-plan-avatar-fallback"
                style={{ display: member.profilePicture ? 'none' : 'grid' }}
              >
                {initials(member.fullName)}
              </div>
            </div>
            <div className="member-plan-identity">
              <span className="member-plan-tag">MEMBER MEMBERSHIP PLAN</span>
              <h2>{member.fullName}</h2>
              <div className="member-plan-meta">
                <span>{member.memberId || 'ID Pending'}</span>
                {member.mobileNumber && (
                  <>
                    <i className="meta-dot" />
                    <span>
                      <Phone size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                      {member.mobileNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="member-plan-quick-body">
          {loading ? (
            <div className="member-plan-loading-state">
              <Loader2 size={24} className="spin" />
              <span>Fetching latest membership plan...</span>
            </div>
          ) : error ? (
            <div className="member-plan-error-state">
              <AlertCircle size={24} />
              <span>{error}</span>
            </div>
          ) : membership ? (
            <div className="member-plan-details-wrapper">
              {/* Primary Luxury Plan Card */}
              <div className={`attendance-popup-plan-card ${isExpired ? 'expired' : 'active'}`}>
                <div className="attendance-popup-plan-header">
                  <div className="attendance-popup-plan-title">
                    <CreditCard size={18} className="plan-icon" />
                    <span className="plan-display-name">{planName}</span>
                    {planDuration && (
                      <span className="plan-duration-pill">{planDuration}</span>
                    )}
                  </div>
                  <div className="plan-status-pills">
                    <span
                      className={`attendance-popup-plan-status ${
                        isExpired ? 'expired' : 'active'
                      }`}
                    >
                      {isExpired ? 'EXPIRED' : (membership.status || 'ACTIVE').toUpperCase()}
                    </span>
                    {membership.paymentStatus && (
                      <span className={`plan-pay-pill ${membership.paymentStatus}`}>
                        {membership.paymentStatus.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* From and Ended Dates */}
                <div className="attendance-popup-plan-dates">
                  <div className="plan-date-col">
                    <span className="plan-date-label">Plan From Date</span>
                    <strong className="plan-date-val">
                      {formatDate(membership.startDate)}
                    </strong>
                  </div>
                  <div className="plan-date-divider">
                    <ArrowRight size={18} />
                  </div>
                  <div className="plan-date-col">
                    <span className="plan-date-label">Ended Date</span>
                    <strong className={`plan-date-val ${isExpired ? 'expired' : 'active'}`}>
                      {formatDate(membership.endDate)}
                    </strong>
                  </div>
                </div>

                {/* Validity days indicator */}
                {daysInfo && (
                  <div className={`plan-days-info ${isExpired ? 'expired' : 'active'}`}>
                    <Clock size={13} />
                    <span>{daysInfo}</span>
                  </div>
                )}
              </div>

              {/* Financial & Additional Details Grid */}
              <div className="member-plan-summary-grid">
                <div className="plan-summary-cell">
                  <small>TOTAL AMOUNT</small>
                  <strong>₹{Number(membership.totalAmount || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="plan-summary-cell">
                  <small>AMOUNT PAID</small>
                  <strong className="text-lime">
                    ₹{Number(membership.amountPaid || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="plan-summary-cell">
                  <small>PENDING BALANCE</small>
                  <strong
                    className={
                      Number(membership.pendingAmount || 0) > 0 ? 'text-coral' : 'text-muted'
                    }
                  >
                    ₹{Number(membership.pendingAmount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="plan-summary-cell">
                  <small>MEMBERSHIP ACTION</small>
                  <strong>
                    {String(membership.action || 'New Membership')
                      .replaceAll('_', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="member-plan-empty-card">
              <AlertTriangle size={28} className="text-coral" />
              <h4>No Active Membership Plan</h4>
              <p>
                This member currently has no recorded membership plan. You can assign a plan
                through the Memberships module.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="member-plan-quick-footer">
          {onViewFullProfile && (
            <button
              type="button"
              className="outline-btn"
              onClick={() => onViewFullProfile(member)}
            >
              <UserRound size={14} /> View Full Profile
            </button>
          )}
          <button type="button" className="lime-btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </article>
    </div>
  );
}
