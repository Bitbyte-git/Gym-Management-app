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
  Edit3,
  Check,
  Save,
  RotateCcw,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const text = value => value === undefined || value === null || value === '' ? 'Not provided' : String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided';
const initials = name => String(name || 'Member').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

const formatDateInput = (val) => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const Info = ({ icon: Icon, label, value }) => (
  <div className="profile-info-card">
    <div className="profile-info-icon-wrap">
      <Icon size={15} />
    </div>
    <div className="profile-info-content">
      <small className="profile-info-label">{label}</small>
      <strong className="profile-info-value">{value}</strong>
    </div>
  </div>
);

export default function MemberProfileModal({ member, onClose, onUpdate }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'reception';

  const [currentMember, setCurrentMember] = useState(member);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const account = currentMember.user || {};
  const active = currentMember.membershipStatus === 'active' && account.isActive !== false;
  const [profilePic, setProfilePic] = useState(currentMember.profilePicture);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [membership, setMembership] = useState(currentMember.latestMembership || null);
  const [loadingMembership, setLoadingMembership] = useState(!currentMember.latestMembership);
  const fileInputRef = useRef(null);

  // Form State for Admin Editing
  const [formData, setFormData] = useState({
    fullName: currentMember.fullName || '',
    mobileNumber: currentMember.mobileNumber || '',
    email: account.email || currentMember.email || '',
    dateOfBirth: formatDateInput(currentMember.dateOfBirth),
    gender: currentMember.gender || 'male',
    address: currentMember.address || '',
    emergencyContactName: currentMember.emergencyContactName || '',
    emergencyContactPhone: currentMember.emergencyContactPhone || '',
    height: currentMember.height || '',
    weight: currentMember.weight || '',
    fitnessGoal: currentMember.fitnessGoal || 'general_fitness',
    exerciseExperience: currentMember.exerciseExperience || 'beginner',
    registrationStatus: currentMember.registrationStatus || 'completed',
    membershipStatus: currentMember.membershipStatus || 'active',
    healthNotes: currentMember.healthNotes || '',
    physicalLimitations: currentMember.physicalLimitations || '',
  });

  useEffect(() => {
    setCurrentMember(member);
    setProfilePic(member.profilePicture);
    setFormData({
      fullName: member.fullName || '',
      mobileNumber: member.mobileNumber || '',
      email: member.user?.email || member.email || '',
      dateOfBirth: formatDateInput(member.dateOfBirth),
      gender: member.gender || 'male',
      address: member.address || '',
      emergencyContactName: member.emergencyContactName || '',
      emergencyContactPhone: member.emergencyContactPhone || '',
      height: member.height || '',
      weight: member.weight || '',
      fitnessGoal: member.fitnessGoal || 'general_fitness',
      exerciseExperience: member.exerciseExperience || 'beginner',
      registrationStatus: member.registrationStatus || 'completed',
      membershipStatus: member.membershipStatus || 'active',
      healthNotes: member.healthNotes || '',
      physicalLimitations: member.physicalLimitations || '',
    });
  }, [member]);

  useEffect(() => {
    if (currentMember.latestMembership) {
      setMembership(currentMember.latestMembership);
      setLoadingMembership(false);
      return;
    }
    const memberId = currentMember._id || currentMember.id;
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
  }, [currentMember._id, currentMember.id, currentMember.latestMembership]);

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
      const formDataUpload = new FormData();
      formDataUpload.append('avatar', file);
      const res = await api.post(`/members/${currentMember._id}/avatar`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updatedPic = res.data?.data?.profilePicture;
      if (updatedPic) {
        setProfilePic(updatedPic);
        const updated = { ...currentMember, profilePicture: updatedPic };
        setCurrentMember(updated);
        onUpdate?.(updated);
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const memberId = currentMember._id || currentMember.id;
      const payload = {
        fullName: formData.fullName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        gender: formData.gender,
        address: formData.address.trim(),
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        height: formData.height ? Number(formData.height) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        fitnessGoal: formData.fitnessGoal,
        exerciseExperience: formData.exerciseExperience,
        healthNotes: formData.healthNotes?.trim() || '',
        physicalLimitations: formData.physicalLimitations?.trim() || '',
      };
      if (formData.dateOfBirth) {
        payload.dateOfBirth = formData.dateOfBirth;
      }
      if (user?.role === 'admin' && formData.registrationStatus) {
        payload.registrationStatus = formData.registrationStatus;
      }

      const res = await api.put(`/members/${memberId}`, payload);
      const updated = res.data?.data || { ...currentMember, ...payload };
      setCurrentMember(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 700);
      onUpdate?.(updated);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to update member profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="member-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${currentMember.fullName} member profile`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <article className="member-profile-modal" style={{ maxWidth: '540px', width: 'min(540px, 94vw)', colorScheme: 'dark' }}>
        {/* Header Hero */}
        <header className="member-profile-hero">
          <button
            className="member-modal-close"
            onClick={onClose}
            aria-label="Close member profile"
            disabled={saving}
          >
            <X size={18} />
          </button>

          <div className="member-profile-avatar-wrap">
            {profilePic ? (
              <img
                src={profilePic}
                alt={currentMember.fullName}
                className="member-profile-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid';
                }}
              />
            ) : null}
            <div
              className="member-profile-avatar member-avatar-initials"
              style={{
                display: profilePic ? 'none' : 'grid',
                background: 'linear-gradient(135deg, rgba(212, 255, 0, 0.18) 0%, rgba(18, 26, 20, 0.95) 100%)',
                color: '#d4ff00',
                border: 'none',
                boxShadow: 'inset 0 0 14px rgba(212, 255, 0, 0.08)',
              }}
            >
              {initials(currentMember.fullName)}
            </div>
            <button
              type="button"
              className="member-profile-avatar-edit-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
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
            <span className="member-profile-tag">MEMBER PROFILE</span>
            <h2>{currentMember.fullName}</h2>
            <div className="member-profile-meta-chips">
              <span className="member-id-capsule">{currentMember.memberId || 'GYM-NEW'}</span>
              <span className="meta-sep">•</span>
              <span className="joined-date-text">Joined {date(currentMember.createdAt)}</span>
            </div>
            {uploadError && <small className="avatar-upload-err">{uploadError}</small>}
          </div>

          <div className="member-hero-right-actions">
            <div className={`member-profile-status ${active ? 'active' : ''}`}>
              <span className="status-dot" />
              <span className="status-text" style={{ whiteSpace: 'nowrap' }}>{active ? 'ACTIVE MEMBER' : text(currentMember.membershipStatus || 'INACTIVE')}</span>
            </div>
          </div>
        </header>

        {isEditing ? (
          /* ================= EDIT MODE (ADMIN / RECEPTION) ================= */
          <form className="member-profile-edit-form" onSubmit={handleSaveProfile}>
            <div className="member-edit-head-notice">
              <div className="edit-notice-badge">
                <Edit3 size={15} />
                <span>EDITING MEMBER DETAILS</span>
              </div>
              <p>Update member personal identity, emergency contacts, or fitness profile.</p>
            </div>

            {saveError && (
              <div className="alert-error profile-alert">
                <AlertTriangle size={15} />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div className="alert-success profile-alert">
                <Check size={15} />
                <span>Profile details saved successfully!</span>
              </div>
            )}

            <div className="member-edit-form-grid">
              {/* Personal Identity */}
              <div className="member-form-section-title">
                <UserRound size={15} />
                <span>PERSONAL INFORMATION</span>
              </div>

              <label className="luxury-field-label">
                <span className="field-tag">FULL NAME *</span>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="luxury-form-input"
                  placeholder="Enter full name"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">MOBILE NUMBER *</span>
                <input
                  type="tel"
                  required
                  value={formData.mobileNumber}
                  onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                  className="luxury-form-input"
                  placeholder="10-digit mobile"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">DATE OF BIRTH</span>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="luxury-form-input"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">GENDER</span>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="luxury-form-select"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="luxury-field-label full-width">
                <span className="field-tag">ADDRESS</span>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="luxury-form-input"
                  placeholder="Residential address"
                />
              </label>

              {/* Body & Fitness Metrics */}
              <div className="member-form-section-title">
                <Activity size={15} />
                <span>BODY & FITNESS METRICS</span>
              </div>

              <label className="luxury-field-label">
                <span className="field-tag">HEIGHT (CM)</span>
                <input
                  type="number"
                  min="50"
                  max="260"
                  step="0.5"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  className="luxury-form-input"
                  placeholder="e.g. 175"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">WEIGHT (KG)</span>
                <input
                  type="number"
                  min="20"
                  max="300"
                  step="0.5"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="luxury-form-input"
                  placeholder="e.g. 70"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">FITNESS GOAL</span>
                <select
                  value={formData.fitnessGoal}
                  onChange={(e) => handleInputChange('fitnessGoal', e.target.value)}
                  className="luxury-form-select"
                >
                  <option value="general_fitness">General Fitness</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="strength">Strength & Conditioning</option>
                  <option value="endurance">Endurance</option>
                  <option value="mobility">Flexibility & Mobility</option>
                </select>
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">EXERCISE EXPERIENCE</span>
                <select
                  value={formData.exerciseExperience}
                  onChange={(e) => handleInputChange('exerciseExperience', e.target.value)}
                  className="luxury-form-select"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>

              {/* Emergency Contact */}
              <div className="member-form-section-title">
                <ShieldCheck size={15} />
                <span>EMERGENCY CONTACT</span>
              </div>

              <label className="luxury-field-label">
                <span className="field-tag">CONTACT PERSON NAME</span>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                  className="luxury-form-input"
                  placeholder="Contact person"
                />
              </label>

              <label className="luxury-field-label">
                <span className="field-tag">EMERGENCY PHONE</span>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                  className="luxury-form-input"
                  placeholder="Emergency contact phone"
                />
              </label>

              {/* Admin Registration Status */}
              {user?.role === 'admin' && (
                <>
                  <div className="member-form-section-title">
                    <ShieldCheck size={15} />
                    <span>ADMIN ACCOUNT STATUS</span>
                  </div>

                  <label className="luxury-field-label full-width">
                    <span className="field-tag">REGISTRATION STATUS</span>
                    <select
                      value={formData.registrationStatus}
                      onChange={(e) => handleInputChange('registrationStatus', e.target.value)}
                      className="luxury-form-select"
                    >
                      <option value="completed">Completed / Active</option>
                      <option value="pending">Pending Registration</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                </>
              )}

              {/* Health Notes */}
              <div className="member-form-section-title">
                <HeartPulse size={15} />
                <span>HEALTH & WELLNESS NOTES (OPTIONAL)</span>
              </div>

              <label className="luxury-field-label full-width">
                <span className="field-tag">MEDICAL CONDITIONS / HEALTH NOTES</span>
                <textarea
                  rows={2}
                  value={formData.healthNotes}
                  onChange={(e) => handleInputChange('healthNotes', e.target.value)}
                  className="luxury-form-textarea"
                  placeholder="Previous conditions, surgeries, or limitations..."
                />
              </label>
            </div>

            <footer className="member-profile-footer">
              <button
                type="button"
                className="outline-btn"
                disabled={saving}
                onClick={() => {
                  setIsEditing(false);
                  setSaveError('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="lime-btn save-profile-btn"
                disabled={saving}
              >
                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </footer>
          </form>
        ) : (
          /* ================= VIEW MODE ================= */
          <>
            {/* Body Metrics Grid */}
            <section className="member-profile-metrics">
              <div className="metric-box">
                <small>HEIGHT</small>
                <strong>{currentMember.height ? `${currentMember.height} cm` : '—'}</strong>
              </div>
              <div className="metric-box">
                <small>WEIGHT</small>
                <strong>{currentMember.weight ? `${currentMember.weight} kg` : '—'}</strong>
              </div>
              <div className="metric-box">
                <small>FITNESS GOAL</small>
                <strong>{text(currentMember.fitnessGoal)}</strong>
              </div>
              <div className="metric-box">
                <small>EXPERIENCE</small>
                <strong>{text(currentMember.exerciseExperience)}</strong>
              </div>
            </section>

            <div className="member-profile-body">
              {/* Latest Membership Plan Section */}
              <section className="member-profile-section member-plan-profile-section">
                <div className="member-section-title">
                  <CreditCard size={17} />
                  <div>
                    <h3>Latest Membership Plan</h3>
                    <p>Active plan subscription and validity dates</p>
                  </div>
                </div>

                {loadingMembership ? (
                  <div className="member-plan-loading-state">
                    <Loader2 size={18} className="spin" />
                    <span>Loading membership plan...</span>
                  </div>
                ) : membership ? (
                  <div className={`attendance-popup-plan-card ${isExpired ? 'expired' : 'active'}`}>
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
                        <ArrowRight size={15} />
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

              {/* Personal Information */}
              <section className="member-profile-section">
                <div className="member-section-title">
                  <UserRound size={17} />
                  <div>
                    <h3>Personal Information</h3>
                    <p>Identity and account details</p>
                  </div>
                </div>
                <div className="member-info-grid">
                  <Info icon={Mail} label="Email Address" value={account.email || currentMember.email || 'Not provided'} />
                  <Info icon={Phone} label="Mobile Number" value={currentMember.mobileNumber || 'Not provided'} />
                  <Info icon={CalendarDays} label="Date of Birth" value={date(currentMember.dateOfBirth)} />
                  <Info icon={UserRound} label="Gender" value={text(currentMember.gender)} />
                  <Info icon={MapPin} label="Address" value={currentMember.address || 'Not provided'} />
                  <Info icon={ShieldCheck} label="Registration" value={text(currentMember.registrationStatus)} />
                </div>
              </section>

              {/* Emergency Contact */}
              <section className="member-profile-section">
                <div className="member-section-title">
                  <ShieldCheck size={17} />
                  <div>
                    <h3>Emergency Contact</h3>
                    <p>Primary contact in case of emergency</p>
                  </div>
                </div>
                <div className="member-info-grid compact">
                  <Info icon={UserRound} label="Contact Name" value={currentMember.emergencyContactName || 'Not provided'} />
                  <Info icon={Phone} label="Contact Phone" value={currentMember.emergencyContactPhone || 'Not provided'} />
                </div>
              </section>

              {/* Health Notes (if present) */}
              {['previousDiseases', 'recentOperations', 'healthNotes', 'physicalLimitations'].some(key => currentMember[key] !== undefined && currentMember[key] !== '') && (
                <section className="member-profile-section health-section">
                  <div className="member-section-title">
                    <HeartPulse size={17} />
                    <div>
                      <h3>Health and Fitness Notes</h3>
                      <p>Wellness and physical limitation information</p>
                    </div>
                  </div>
                  <div className="health-note-grid">
                    <div>
                      <small>PREVIOUS CONDITIONS</small>
                      <p>{text(currentMember.previousDiseases)}</p>
                    </div>
                    <div>
                      <small>RECENT OPERATIONS</small>
                      <p>{text(currentMember.recentOperations)}</p>
                    </div>
                    <div>
                      <small>HEALTH NOTES</small>
                      <p>{currentMember.healthNotes || 'None recorded'}</p>
                    </div>
                    <div>
                      <small>PHYSICAL LIMITATIONS</small>
                      <p>{currentMember.physicalLimitations || 'None recorded'}</p>
                    </div>
                  </div>
                  {currentMember.healthConsentAt && (
                    <p className="health-consent">
                      <Activity size={14} /> Consent recorded on {date(currentMember.healthConsentAt)}
                    </p>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="member-profile-footer">
              <span className="footer-role-notice">
                <ShieldCheck size={14} /> Member data is visible according to your assigned role.
              </span>
              <div className="footer-action-buttons">
                {canEdit && (
                  <button
                    type="button"
                    className="outline-btn edit-member-btn"
                    onClick={() => {
                      setIsEditing(true);
                      setSaveError('');
                    }}
                  >
                    <Edit3 size={14} />
                    <span>Edit Profile</span>
                  </button>
                )}
                <button className="lime-btn done-btn" onClick={onClose}>
                  Done
                </button>
              </div>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
