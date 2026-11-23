import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  CalendarDays,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  X,
  Camera,
  Loader2,
  CreditCard,
  ArrowRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';

const text = value => value === undefined || value === null || value === '' ? 'Not provided' : String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided';
const initials = name => String(name || 'Member').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

const Info = ({ icon: Icon, label, value }) => <div className="profile-info">
  <span><Icon size={16}/></span><div><small>{label}</small><strong>{value}</strong></div>
</div>;

export default function MemberProfileModal({ member, onClose, onUpdate }) {
  const account = member.user || {};
  const active = member.membershipStatus === 'active' && account.isActive !== false;
  const [profilePic, setProfilePic] = useState(member.profilePicture);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [membership, setMembership] = useState(member.latestMembership || null);
  const [loadingMembership, setLoadingMembership] = useState(!member.latestMembership);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (member.latestMembership) {
      setMembership(member.latestMembership);
      setLoadingMembership(false);
      return;
    }
    const memberId = member._id || member.id;
    if (!memberId) {
      setLoadingMembership(false);
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
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingMembership(false);
      });
    return () => {
      isMounted = false;
    };
  }, [member._id, member.id, member.latestMembership]);

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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post(`/members/${member._id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedPic = res.data?.data?.profilePicture;
      if (updatedPic) {
        setProfilePic(updatedPic);
        onUpdate?.(res.data.data);
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return <div className="member-modal-overlay" role="dialog" aria-modal="true" aria-label={`${member.fullName} member profile`}>
    <article className="member-profile-modal">
      <header className="member-profile-hero">
        <button className="member-modal-close" onClick={onClose} aria-label="Close member profile"><X size={19}/></button>
        <div className="member-profile-avatar-wrap">
          {profilePic ? (
            <img
              src={profilePic}
              alt={member.fullName}
              className="member-profile-avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid';
              }}
            />
          ) : null}
          <div
            className="member-profile-avatar"
            style={{ display: profilePic ? 'none' : 'grid' }}
          >
            {initials(member.fullName)}
          </div>
          <button
            type="button"
            className="member-profile-avatar-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload / Change Member Photo"
            aria-label="Upload photo"
          >
            {uploading ? <Loader2 size={13} className="spin" /> : <Camera size={13} />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
        <div className="member-profile-identity">
          <span>MEMBER PROFILE</span><h2>{member.fullName}</h2>
          <p>{member.memberId} <i/> Joined {date(member.createdAt)}</p>
          {uploadError && <small className="avatar-upload-err">{uploadError}</small>}
        </div>
        <div className={`member-profile-status ${active ? 'active' : ''}`}><span/>{active ? 'Active member' : text(member.membershipStatus || 'Inactive')}</div>
      </header>

      <section className="member-profile-metrics">
        <div><small>HEIGHT</small><strong>{member.height ? `${member.height} cm` : '—'}</strong></div>
        <div><small>WEIGHT</small><strong>{member.weight ? `${member.weight} kg` : '—'}</strong></div>
        <div><small>FITNESS GOAL</small><strong>{text(member.fitnessGoal)}</strong></div>
        <div><small>EXPERIENCE</small><strong>{text(member.exerciseExperience)}</strong></div>
      </section>

      <div className="member-profile-body">
        {/* Latest Membership Plan Section */}
        <section className="member-profile-section member-plan-profile-section">
          <div className="member-section-title">
            <CreditCard size={18} />
            <div>
              <h3>Latest Membership Plan</h3>
              <p>Active plan subscription and validity dates</p>
            </div>
          </div>

          {loadingMembership ? (
            <div className="member-plan-loading-state" style={{ padding: '16px 0' }}>
              <Loader2 size={18} className="spin" />
              <span>Loading membership plan...</span>
            </div>
          ) : membership ? (
            <div className={`attendance-popup-plan-card ${isExpired ? 'expired' : 'active'}`} style={{ margin: '0 0 6px' }}>
              <div className="attendance-popup-plan-header">
                <div className="attendance-popup-plan-title">
                  <CreditCard size={16} className="plan-icon" />
                  <span className="plan-display-name">{planName}</span>
                  {planDuration && (
                    <span className="plan-duration-pill">{planDuration}</span>
                  )}
                </div>
                <div className="plan-status-pills">
                  <span className={`attendance-popup-plan-status ${isExpired ? 'expired' : 'active'}`}>
                    {isExpired ? 'EXPIRED' : (membership.status || 'ACTIVE').toUpperCase()}
                  </span>
                  {membership.paymentStatus && (
                    <span className={`plan-pay-pill ${membership.paymentStatus}`}>
                      {membership.paymentStatus.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="attendance-popup-plan-dates">
                <div className="plan-date-col">
                  <span className="plan-date-label">Plan From Date</span>
                  <strong className="plan-date-val">
                    {date(membership.startDate)}
                  </strong>
                </div>
                <div className="plan-date-divider">
                  <ArrowRight size={16} />
                </div>
                <div className="plan-date-col">
                  <span className="plan-date-label">Ended Date</span>
                  <strong className={`plan-date-val ${isExpired ? 'expired' : 'active'}`}>
                    {date(membership.endDate)}
                  </strong>
                </div>
              </div>

              {daysInfo && (
                <div className={`plan-days-info ${isExpired ? 'expired' : 'active'}`}>
                  <Clock size={13} />
                  <span>{daysInfo}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="member-plan-empty-banner">
              <AlertTriangle size={16} className="text-coral" />
              <span>No active membership plan currently registered for this member.</span>
            </div>
          )}
        </section>

        <section className="member-profile-section">
          <div className="member-section-title"><UserRound/><div><h3>Personal information</h3><p>Identity and account details</p></div></div>
          <div className="member-info-grid">
            <Info icon={Mail} label="Email address" value={account.email || 'Not provided'}/>
            <Info icon={Phone} label="Mobile number" value={member.mobileNumber || 'Not provided'}/>
            <Info icon={CalendarDays} label="Date of birth" value={date(member.dateOfBirth)}/>
            <Info icon={UserRound} label="Gender" value={text(member.gender)}/>
            <Info icon={MapPin} label="Address" value={member.address || 'Not provided'}/>
            <Info icon={ShieldCheck} label="Registration" value={text(member.registrationStatus)}/>
          </div>
        </section>

        <section className="member-profile-section">
          <div className="member-section-title"><ShieldCheck/><div><h3>Emergency contact</h3><p>Primary contact in an emergency</p></div></div>
          <div className="member-info-grid compact">
            <Info icon={UserRound} label="Contact name" value={member.emergencyContactName || 'Not provided'}/>
            <Info icon={Phone} label="Contact phone" value={member.emergencyContactPhone || 'Not provided'}/>
          </div>
        </section>

        {['previousDiseases', 'recentOperations', 'healthNotes', 'physicalLimitations'].some(key => member[key] !== undefined) && <section className="member-profile-section health-section">
          <div className="member-section-title"><HeartPulse/><div><h3>Health and fitness notes</h3><p>Restricted wellness information</p></div></div>
          <div className="health-note-grid">
            <div><small>PREVIOUS CONDITIONS</small><p>{text(member.previousDiseases)}</p></div>
            <div><small>RECENT OPERATIONS</small><p>{text(member.recentOperations)}</p></div>
            <div><small>HEALTH NOTES</small><p>{member.healthNotes || 'None recorded'}</p></div>
            <div><small>PHYSICAL LIMITATIONS</small><p>{member.physicalLimitations || 'None recorded'}</p></div>
          </div>
          <p className="health-consent"><Activity size={14}/> Consent recorded {member.healthConsentAt ? `on ${date(member.healthConsentAt)}` : '—'}</p>
        </section>}
      </div>

      <footer className="member-profile-footer"><span><ShieldCheck size={15}/> Member data is visible according to your assigned role.</span><button className="lime-btn" onClick={onClose}>Done</button></footer>
    </article>
  </div>;
}
