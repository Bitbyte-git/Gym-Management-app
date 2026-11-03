import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, User, Heart, CreditCard, Calendar, UserCheck, ShieldCheck, Edit3, Clock, Sparkles, Activity, CheckCircle2, Camera, Upload, Trash2, ChevronLeft, ChevronRight, Cloud, CloudUpload } from 'lucide-react';
import { registrationService } from '../services';
import { openRazorpayCheckout } from '../services/razorpay';
import { Brand } from '../components/Brand';
import { DEFAULT_AVATARS } from '../data';

const STEPS = [
  { id: 'basic', title: 'Basic Details', icon: User },
  { id: 'health', title: 'Health & Fitness', icon: Heart },
  { id: 'plan', title: 'Membership Plan', icon: CreditCard },
  { id: 'slot', title: 'Time Slot', icon: Calendar },
  { id: 'trainer', title: 'Trainer (Optional)', icon: UserCheck },
  { id: 'review', title: 'Review', icon: Check },
];

export default function Register() {
  const navigate = useNavigate();
  const avatarScrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadNotice, setAvatarUploadNotice] = useState('');

  const scrollAvatars = (direction) => {
    if (avatarScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      avatarScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleCustomPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setBasicData((prev) => ({ ...prev, profilePicture: localPreview }));
    setUploadingAvatar(true);
    setError('');
    setAvatarUploadNotice('Uploading image to Cloudinary...');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await registrationService.uploadAvatar(formData);
      const cloudinaryUrl = response.data.data?.url;
      if (cloudinaryUrl) {
        setBasicData((prev) => ({ ...prev, profilePicture: cloudinaryUrl }));
        setAvatarUploadNotice('Image successfully stored in Cloudinary!');
        setTimeout(() => setAvatarUploadNotice(''), 4500);
      }
    } catch (err) {
      const errMessage = err.response?.data?.error || err.message || 'Failed to upload image to Cloudinary';
      setError(errMessage);
      setAvatarUploadNotice('');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };
  
  // Form data
  const [basicData, setBasicData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    mobile: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    profilePicture: '',
  });

  const [healthData, setHealthData] = useState({
    height: '',
    weight: '',
    fitnessGoal: '',
    exerciseExperience: '',
    previousDiseases: '',
    recentOperations: '',
    healthNotes: '',
    physicalLimitations: '',
  });

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('in_progress');
  const [resumeMode, setResumeMode] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);

  useEffect(() => {
    loadPlans();
    restoreDraft();
  }, []);

  const restoreDraft = async () => {
    if (!localStorage.getItem('registrationToken')) return;
    try {
      const response = await registrationService.getSummary();
      const draft = response.data.data;
      const details = draft.basicDetails || {};
      setBasicData((current) => ({
        ...current,
        email: draft.email || '',
        firstName: details.fullName?.split(' ').slice(0, -1).join(' ') || '',
        lastName: details.fullName?.split(' ').slice(-1).join(' ') || '',
        dateOfBirth: details.dateOfBirth?.slice(0, 10) || '',
        gender: details.gender || '',
        mobile: details.mobileNumber || '',
        address: details.address || '',
        emergencyContactName: details.emergencyContactName || '',
        emergencyContactPhone: details.emergencyContactPhone || '',
        profilePicture: details.profilePicture || '',
      }));
      if (draft.healthDetails) setHealthData((current) => ({ ...current, ...draft.healthDetails }));
      setSelectedPlan(draft.selection?.plan || null);
      setSelectedSlot(draft.selection?.slot || null);
      setSelectedTrainer(draft.selection?.trainer || null);
      setRegistrationStatus(draft.status);
      if (['pending_payment', 'completed'].includes(draft.status)) setCurrentStep(5);
      if (['pending_payment', 'completed'].includes(draft.status)) {
        setCompleted(true);
      } else if (draft.selection?.plan && draft.selection?.slot) {
        setCurrentStep(5);
        await loadSlots(draft.selection.plan._id);
        await loadTrainers(draft.selection.slot?._id);
      } else if (draft.healthDetails?.height) {
        setCurrentStep(2);
      }
    } catch (err) {
      if ([404, 410].includes(err.response?.status)) localStorage.removeItem('registrationToken');
      setError(err.response?.data?.error || 'Could not resume the saved registration. Start again.');
    }
  };

  const loadPlans = async () => {
    try {
      const response = await registrationService.getPlans();
      setPlans(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load membership plans. Please try again.');
    }
  };

  const loadSlots = async (planId) => {
    try {
      const response = await registrationService.getSlots(planId);
      const unique = [];
      const seen = new Set();
      const ordered = [...response.data.data].sort((a, b) => (a.dayOfWeek === 'monday' ? -1 : 0) - (b.dayOfWeek === 'monday' ? -1 : 0));
      for (const item of ordered) {
        const key = `${item.name}|${item.startTime}|${item.endTime}`;
        if (!seen.has(key)) { seen.add(key); unique.push(item); }
      }
      setSlots(unique);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load available time slots. Please try again.');
    }
  };

  const loadTrainers = async (slotId) => {
    try {
      const response = await registrationService.getTrainers(slotId);
      setTrainers(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load trainers. Please try again.');
    }
  };

  const handleBasicSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (basicData.password !== basicData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await registrationService.saveBasicDetails(basicData);
      setLoading(false);
      setCurrentStep(1);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save basic details');
    }
  };

  const handleHealthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registrationService.saveHealthDetails({ ...healthData, healthConsent });
      setLoading(false);
      setCurrentStep(2);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save health details');
    }
  };

  const handlePlanSelect = async (plan) => {
    setSelectedPlan(plan);
    setSelectedSlot(null);
    setSelectedTrainer(null);
    await loadSlots(plan._id);
    setCurrentStep(3);
  };

  const handleSlotSelect = async (slot) => {
    setSelectedSlot(slot);
    setSelectedTrainer(null);
    await loadTrainers(slot._id);
    setCurrentStep(4);
  };

  const saveSelection = async (trainer) => {
    setError('');
    setLoading(true);
    try {
      await registrationService.saveSelection({
        planId: selectedPlan._id,
        slotId: selectedSlot._id,
        trainerId: trainer?._id,
      });
      setSelectedTrainer(trainer);
      setCurrentStep(5);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save your selections.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrainerSelect = (trainer) => {
    saveSelection(trainer);
  };

  const handleSkipTrainer = () => {
    saveSelection(null);
  };

  const handleCompleteRegistration = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await registrationService.complete({});
      setRegistrationStatus(result.data.data.status);
      setLoading(false);
      setCompleted(true);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderBasicDetails();
      case 1:
        return renderHealthDetails();
      case 2:
        return renderPlanSelection();
      case 3:
        return renderSlotSelection();
      case 4:
        return renderTrainerSelection();
      case 5:
        return renderReview();
      default:
        return null;
    }
  };

  const beginCheckout = async () => {
    setLoading(true); setError('');
    try {
      const response = await registrationService.checkout();
      if (response.data.data.completed) { await restoreDraft(); return; }
      const payment = await openRazorpayCheckout(response.data.data);
      await registrationService.verifyPayment(payment);
      await restoreDraft();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to complete Razorpay payment');
    } finally { setLoading(false); }
  };
  const resume = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try { await registrationService.resume({ email: basicData.email, password: basicData.password }); await restoreDraft(); setResumeMode(false); }
    catch (err) { setError(err.response?.data?.error || 'Unable to resume registration'); }
    finally { setLoading(false); }
  };
  const renderBasicDetails = () => (
    <form onSubmit={handleBasicSubmit} className="registration-form">
      <h2>Basic Information</h2>

      {/* Select Profile Picture Section */}
      <div className="profile-picture-section">
        <div className="profile-picture-header">
          <div>
            <label className="profile-picture-label">
              <Camera size={18} /> Select Profile Picture
            </label>
            <p className="profile-picture-hint">
              Choose your profile avatar from the studio collection or upload your photo. This picture will appear on your profile and on attendance punching verification!
            </p>
          </div>
          {basicData.profilePicture && (
            <button
              type="button"
              className="profile-picture-clear-btn"
              onClick={() => setBasicData({ ...basicData, profilePicture: '' })}
              title="Reset to Initials"
            >
              <Trash2 size={13} /> Reset to Initials
            </button>
          )}
        </div>

        {/* Selected preview & upload controls */}
        <div className="profile-picture-top-bar">
          <div className="profile-picture-preview-wrap">
            {basicData.profilePicture ? (
              <img
                src={basicData.profilePicture}
                alt="Selected profile"
                className="profile-picture-preview-img"
              />
            ) : (
              <div className="profile-picture-preview-placeholder">
                {((basicData.firstName?.[0] || '') + (basicData.lastName?.[0] || '')).toUpperCase() || 'VF'}
              </div>
            )}
            <span className="profile-picture-badge" title={basicData.profilePicture ? 'Custom Profile Picture Active' : 'Default Initials'}>
              {basicData.profilePicture ? <Check size={14} strokeWidth={3} /> : <User size={14} />}
            </span>
          </div>

          <div className="profile-picture-actions-wrap">
            <div className="profile-picture-status-info">
              <div className="profile-status-tags-row">
                <span className="profile-status-tag">
                  {basicData.profilePicture ? 'Selected Profile Photo' : 'Using Default Initials'}
                </span>
                {basicData.profilePicture?.includes('cloudinary.com') && (
                  <span className="profile-status-tag cloudinary">
                    <Cloud size={11} /> Cloudinary Stored
                  </span>
                )}
              </div>
              <p className="profile-status-desc">
                {basicData.profilePicture
                  ? (basicData.profilePicture?.includes('cloudinary.com')
                      ? 'Real user image stored in Cloudinary! This picture will appear on the attendance screen.'
                      : 'Great choice! This image will appear on the attendance screen when you punch in or out.')
                  : 'Select an avatar from the studio collection or upload your real photo to Cloudinary.'}
              </p>
              {avatarUploadNotice && (
                <div className="profile-upload-notice-pill">
                  {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} color="var(--lime)" />}
                  <span>{avatarUploadNotice}</span>
                </div>
              )}
            </div>

            <div className="profile-picture-upload-row">
              <label className={`profile-picture-upload-btn ${uploadingAvatar ? 'disabled' : ''}`}>
                {uploadingAvatar ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading to Cloudinary...</>
                ) : (
                  <><CloudUpload size={14} /> Upload to Cloudinary</>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  style={{ display: 'none' }}
                  disabled={uploadingAvatar}
                  onChange={handleCustomPhotoUpload}
                />
              </label>
              <span className="profile-picture-upload-hint">Uploads real user photo to Cloudinary CDN (up to 5MB)</span>
            </div>
          </div>
        </div>

        {/* Scrollable Avatar Carousel Area */}
        <div className="profile-avatar-carousel-container">
          <div className="profile-carousel-header">
            <span className="profile-picture-options-title">
              Studio Avatars <span className="carousel-count">({DEFAULT_AVATARS.length} Available • Scroll to select)</span>
            </span>
            <div className="carousel-nav-buttons">
              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={() => scrollAvatars('left')}
                title="Scroll Left"
                aria-label="Scroll avatars left"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="carousel-arrow-btn"
                onClick={() => scrollAvatars('right')}
                title="Scroll Right"
                aria-label="Scroll avatars right"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="profile-picture-scroll-track" ref={avatarScrollRef}>
            {DEFAULT_AVATARS.map((avatar) => {
              const isSelected = basicData.profilePicture === avatar.url || basicData.profilePicture === avatar.fallbackUrl;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  className={`profile-avatar-choice ${isSelected ? 'selected' : ''}`}
                  onClick={() => setBasicData({ ...basicData, profilePicture: avatar.url })}
                  title={`Select ${avatar.label}`}
                  aria-label={`Select ${avatar.label}`}
                >
                  <img
                    src={avatar.url}
                    alt={avatar.label}
                    onError={(e) => {
                      if (avatar.fallbackUrl && e.currentTarget.src !== avatar.fallbackUrl) {
                        e.currentTarget.src = avatar.fallbackUrl;
                      }
                    }}
                  />
                  {isSelected && (
                    <span className="avatar-choice-check">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                  <span className="avatar-choice-label">{avatar.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <label>
          First Name *
          <input
            type="text"
            value={basicData.firstName}
            onChange={e => setBasicData({ ...basicData, firstName: e.target.value })}
            required
          />
        </label>
        <label>
          Last Name *
          <input
            type="text"
            value={basicData.lastName}
            onChange={e => setBasicData({ ...basicData, lastName: e.target.value })}
            required
          />
        </label>
        <label>
          Email *
          <input
            type="email"
            value={basicData.email}
            onChange={e => setBasicData({ ...basicData, email: e.target.value })}
            required
          />
        </label>
        <label>
          Mobile Number *
          <input
            type="tel"
            value={basicData.mobile}
            onChange={e => setBasicData({ ...basicData, mobile: e.target.value })}
            required
          />
        </label>
        <label>
          Date of Birth *
          <input
            type="date"
            value={basicData.dateOfBirth}
            onChange={e => setBasicData({ ...basicData, dateOfBirth: e.target.value })}
            required
          />
        </label>
        <label>
          Gender *
          <select
            value={basicData.gender}
            onChange={e => setBasicData({ ...basicData, gender: e.target.value })}
            required
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="full-width">
          Address
          <input
            type="text"
            value={basicData.address}
            onChange={e => setBasicData({ ...basicData, address: e.target.value })}
          />
        </label>
        <label>
          Emergency Contact Name *
          <input
            type="text"
            value={basicData.emergencyContactName}
            onChange={e => setBasicData({ ...basicData, emergencyContactName: e.target.value })}
            required
          />
        </label>
        <label>
          Emergency Contact Phone *
          <input
            type="tel"
            value={basicData.emergencyContactPhone}
            onChange={e => setBasicData({ ...basicData, emergencyContactPhone: e.target.value })}
            required
          />
        </label>
        <label>
          Password *
          <input
            type="password"
            value={basicData.password}
            onChange={e => setBasicData({ ...basicData, password: e.target.value })}
            required
          />
        </label>
        <label>
          Confirm Password *
          <input
            type="password"
            value={basicData.confirmPassword}
            onChange={e => setBasicData({ ...basicData, confirmPassword: e.target.value })}
            required
          />
        </label>
      </div>
      <button type="submit" className="lime-btn" disabled={loading}>
        {loading ? <><Loader2 className="animate-spin"/> Saving...</> : <>Continue <ArrowRight/></>}
      </button>
    </form>
  );

  const renderHealthDetails = () => (
    <form onSubmit={handleHealthSubmit} className="registration-form">
      <h2>Health & Fitness Information</h2>
      <p>Optional medical details may be left blank. Your gym uses these details to support your training; access is restricted to you and authorized administrators.</p>
      <div className={`health-consent-card ${healthConsent ? 'is-consented' : ''}`}>
        <label className="health-consent-label" htmlFor="health-consent-input">
          <input
            id="health-consent-input"
            type="checkbox"
            required
            checked={healthConsent}
            onChange={e => setHealthConsent(e.target.checked)}
          />
          <div className="health-consent-text">
            <span className="health-consent-title">Health Data Consent <em className="required-star">*</em></span>
            <span className="health-consent-desc">I consent to the gym storing my health and fitness information for my membership.</span>
          </div>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Height (cm) *
          <input
            type="number"
            value={healthData.height}
            onChange={e => setHealthData({ ...healthData, height: e.target.value })}
            required
          />
        </label>
        <label>
          Weight (kg) *
          <input
            type="number"
            value={healthData.weight}
            onChange={e => setHealthData({ ...healthData, weight: e.target.value })}
            required
          />
        </label>
        <label>
          Fitness Goal *
          <select
            value={healthData.fitnessGoal}
            onChange={e => setHealthData({ ...healthData, fitnessGoal: e.target.value })}
            required
          >
            <option value="">Select Goal</option>
            <option value="weight_loss">Weight Loss</option>
            <option value="muscle_gain">Muscle Gain</option>
            <option value="strength">Strength</option>
            <option value="general_fitness">General Fitness</option>
            <option value="flexibility">Flexibility</option>
          </select>
        </label>
        <label>
          Exercise Experience *
          <select
            value={healthData.exerciseExperience}
            onChange={e => setHealthData({ ...healthData, exerciseExperience: e.target.value })}
            required
          >
            <option value="">Select Experience</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="not_applicable">Not Applicable</option>
          </select>
        </label>
        <label>
          Previous Diseases
          <select
            value={healthData.previousDiseases}
            onChange={e => setHealthData({ ...healthData, previousDiseases: e.target.value })}
          >
            <option value="">None / Not Applicable</option>
            <option value="diabetes">Diabetes</option>
            <option value="hypertension">Hypertension</option>
            <option value="heart_disease">Heart Disease</option>
            <option value="asthma">Asthma</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Recent Operations
          <select
            value={healthData.recentOperations}
            onChange={e => setHealthData({ ...healthData, recentOperations: e.target.value })}
          >
            <option value="">None / Not Applicable</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="full-width">
          Health Notes (Optional)
          <textarea
            value={healthData.healthNotes}
            onChange={e => setHealthData({ ...healthData, healthNotes: e.target.value })}
            rows={3}
          />
        </label>
        <label className="full-width">
          Physical Limitations (Optional)
          <textarea
            value={healthData.physicalLimitations}
            onChange={e => setHealthData({ ...healthData, physicalLimitations: e.target.value })}
            rows={3}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="outline-btn" onClick={() => setCurrentStep(0)}>
          <ArrowLeft/> Back
        </button>
        <button type="submit" className="lime-btn" disabled={loading}>
          {loading ? <><Loader2 className="animate-spin"/> Saving...</> : <>Continue <ArrowRight/></>}
        </button>
      </div>
    </form>
  );

  const renderPlanSelection = () => (
    <div className="plan-selection">
      <h2>Select Membership Plan</h2>
      {!plans.length && <p>No active plans are available. Contact the gym.</p>}
      <div className="plans-grid">
        {plans.map(plan => (
          <div
            key={plan._id}
            className={`plan-card ${selectedPlan?._id === plan._id ? 'selected' : ''}`}
            onClick={() => handlePlanSelect(plan)}
          >
            <h3>{plan.name}</h3>
            <p className="price">₹{plan.price}<span>/{plan.duration} months</span></p>
            <p className="description">{plan.description}</p>
            <ul>
              {plan.facilities?.map((facility, i) => (
                <li key={i}><Check size={16}/> {facility}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="outline-btn" onClick={() => setCurrentStep(1)}>
          <ArrowLeft/> Back
        </button>
      </div>
    </div>
  );

  const renderSlotSelection = () => (
    <div className="slot-selection">
      <h2>Select Time Slot</h2>
      <p>Choose once. This same time applies on all seven days, subject to the gym being open.</p>
      {!slots.length && <p>No eligible slots are currently available. Choose another plan or contact the gym.</p>}
      <div className="slots-grid">
        {slots.map(slot => (
          <div
            key={slot._id}
            className={`slot-card ${selectedSlot?._id === slot._id ? 'selected' : ''}`}
            onClick={() => handleSlotSelect(slot)}
          >
            <h3>{slot.name}</h3>
            <p>Every day</p><p className="time">{slot.startTime} - {slot.endTime}</p>
            <p className="capacity">{slot.currentCapacity || 0} / {slot.maxCapacity} members</p>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="outline-btn" onClick={() => setCurrentStep(2)}>
          <ArrowLeft/> Back
        </button>
      </div>
    </div>
  );

  const renderTrainerSelection = () => (
    <div className="trainer-selection">
      <h2>Select Trainer (Optional)</h2>
      <div className="trainers-grid">
        {trainers.map(trainer => (
          <div
            key={trainer._id}
            className={`trainer-card ${selectedTrainer?._id === trainer._id ? 'selected' : ''}`}
            onClick={() => handleTrainerSelect(trainer)}
          >
            <div className="trainer-avatar">{trainer.avatarInitials || 'TR'}</div>
            <h3>{trainer.fullName}</h3>
            <p className="specialization">{trainer.specialization}</p>
            <p className="experience">{trainer.experience} years experience</p>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="outline-btn" onClick={() => setCurrentStep(3)}>
          <ArrowLeft/> Back
        </button>
        <button type="button" className="ghost-btn" onClick={handleSkipTrainer}>
          Skip for now
        </button>
      </div>
    </div>
  );

  const formatGoal = (goal) => {
    if (!goal) return 'General Fitness';
    const map = {
      muscle_gain: 'Muscle Gain & Strength',
      weight_loss: 'Weight Loss & Fat Burn',
      endurance: 'Endurance & Stamina',
      flexibility: 'Flexibility & Mobility',
      general_fitness: 'General Fitness & Health',
    };
    return map[goal] || goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatExperience = (exp) => {
    if (!exp) return 'Beginner';
    const map = {
      beginner: 'Beginner (0 - 1 yr)',
      intermediate: 'Intermediate (1 - 3 yrs)',
      advanced: 'Advanced (3+ yrs)',
    };
    return map[exp] || exp.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateBMI = () => {
    const h = parseFloat(healthData.height);
    const w = parseFloat(healthData.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightInMeters = h / 100;
    const bmiVal = (w / (heightInMeters * heightInMeters)).toFixed(1);
    let category = 'Normal';
    if (bmiVal < 18.5) category = 'Underweight';
    else if (bmiVal >= 25 && bmiVal < 30) category = 'Overweight';
    else if (bmiVal >= 30) category = 'Obese';
    return { value: bmiVal, category };
  };

  const renderReview = () => {
    const bmi = calculateBMI();
    return (
      <div className="review-step">
        <div className="review-header-block">
          <span className="review-step-badge">FINAL STEP 05/05</span>
          <h2>Review Your Registration</h2>
          <p className="review-subtitle">
            Verify your information before completing registration and launching secure checkout.
          </p>
        </div>

        {/* Security & Biometrics Alert Banner */}
        <div className="review-notice-banner">
          <div className="review-notice-icon-box">
            <ShieldCheck size={26} />
          </div>
          <div className="review-notice-body">
            <div className="review-notice-tag">ZERO HARDWARE ENROLLMENT REQUIRED</div>
            <h4>Instant Digital Activation & Secure Razorpay Checkout</h4>
            <p>
              Fingerprint enrollment is not required. Save your registration, then pay securely with Razorpay. 
              Your membership activates after payment verification. Capacity is confirmed during activation.
            </p>
          </div>
        </div>

        {/* Review Cards Grid */}
        <div className="review-cards-grid">
          {/* Card 1: Personal Details */}
          <div className="review-card">
            <div className="review-card-head">
              <div className="review-card-title">
                <User size={18} className="review-title-icon" />
                <span>Personal Details</span>
              </div>
              <button 
                type="button" 
                className="review-edit-btn" 
                onClick={() => setCurrentStep(0)}
                title="Edit Personal Details"
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>
            <div className="review-card-body">
              <div className="review-profile-pic-row">
                {basicData.profilePicture ? (
                  <img src={basicData.profilePicture} alt="Profile" className="review-profile-avatar-img" />
                ) : (
                  <div className="review-profile-avatar-placeholder">
                    {((basicData.firstName?.[0] || '') + (basicData.lastName?.[0] || '')).toUpperCase() || 'VF'}
                  </div>
                )}
                <div>
                  <h4 className="review-profile-name">{basicData.firstName} {basicData.lastName}</h4>
                  <span className="review-profile-sub">
                    {basicData.profilePicture ? 'Profile Picture Selected' : 'Default Initials Avatar'}
                  </span>
                </div>
              </div>
              <div className="review-row">
                <span className="review-label">Name</span>
                <span className="review-value review-highlight-val">
                  {basicData.firstName} {basicData.lastName}
                </span>
              </div>
              <div className="review-row">
                <span className="review-label">Email</span>
                <span className="review-value">{basicData.email || '—'}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Mobile</span>
                <span className="review-value">{basicData.mobile || '—'}</span>
              </div>
              <div className="review-row">
                <span className="review-label">DOB</span>
                <span className="review-value">{basicData.dateOfBirth || '—'}</span>
              </div>
              {basicData.gender && (
                <div className="review-row">
                  <span className="review-label">Gender</span>
                  <span className="review-value" style={{ textTransform: 'capitalize' }}>
                    {basicData.gender}
                  </span>
                </div>
              )}
              {basicData.emergencyContactName && (
                <div className="review-row">
                  <span className="review-label">Emergency</span>
                  <span className="review-value">
                    {basicData.emergencyContactName} {basicData.emergencyContactPhone && `(${basicData.emergencyContactPhone})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Health Details */}
          <div className="review-card">
            <div className="review-card-head">
              <div className="review-card-title">
                <Activity size={18} className="review-title-icon" />
                <span>Health Details</span>
              </div>
              <button 
                type="button" 
                className="review-edit-btn" 
                onClick={() => setCurrentStep(1)}
                title="Edit Health Details"
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>
            <div className="review-card-body">
              {/* Stat Chips */}
              <div className="review-stats-chips">
                <div className="review-stat-chip">
                  <span className="chip-label">HEIGHT</span>
                  <strong>{healthData.height ? `${healthData.height} cm` : '—'}</strong>
                </div>
                <div className="review-stat-chip">
                  <span className="chip-label">WEIGHT</span>
                  <strong>{healthData.weight ? `${healthData.weight} kg` : '—'}</strong>
                </div>
                {bmi && (
                  <div className="review-stat-chip">
                    <span className="chip-label">BMI</span>
                    <strong>{bmi.value} <small>({bmi.category})</small></strong>
                  </div>
                )}
              </div>

              <div className="review-row">
                <span className="review-label">Fitness Goal</span>
                <span className="review-goal-badge">
                  {formatGoal(healthData.fitnessGoal)}
                </span>
              </div>
              <div className="review-row">
                <span className="review-label">Experience</span>
                <span className="review-value">{formatExperience(healthData.exerciseExperience)}</span>
              </div>
              <div className="review-row">
                <span className="review-label">Medical Consent</span>
                <span className="review-consent-pill">
                  <CheckCircle2 size={13} /> Signed & Agreed
                </span>
              </div>
              {healthData.healthNotes && (
                <div className="review-row">
                  <span className="review-label">Health Notes</span>
                  <span className="review-value">{healthData.healthNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Membership Details */}
          <div className="review-card review-card-plan">
            <div className="review-card-head">
              <div className="review-card-title">
                <Sparkles size={18} className="review-title-icon" />
                <span>Membership</span>
              </div>
              <button 
                type="button" 
                className="review-edit-btn" 
                onClick={() => setCurrentStep(2)}
                title="Change Membership Plan"
              >
                <Edit3 size={13} /> Change
              </button>
            </div>
            <div className="review-card-body">
              <div className="review-plan-banner">
                <div className="plan-name-wrap">
                  <span className="plan-tag">SELECTED PLAN</span>
                  <h3>{selectedPlan?.name || 'Annual'}</h3>
                </div>
                <div className="plan-price-wrap">
                  <span className="price-tag">₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')}</span>
                  <small>Full Access</small>
                </div>
              </div>

              <div className="review-row">
                <span className="review-label">Requested time slot</span>
                <span className="review-slot-pill">
                  <Clock size={13} /> {selectedSlot?.name || 'Assigned'} ({selectedSlot?.startTime || '10:00'} - {selectedSlot?.endTime || '13:00'})
                </span>
              </div>

              <div className="review-row">
                <span className="review-label">Trainer</span>
                <span className="review-value">
                  {selectedTrainer ? (
                    <span className="review-trainer-name">
                      {selectedTrainer.fullName} ({selectedTrainer.specialization || 'Trainer'})
                    </span>
                  ) : (
                    <span className="review-self-guided">Self-Guided (No Trainer)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Breakdown / Receipt Summary */}
        <div className="review-receipt-summary">
          <div className="receipt-head">
            <span className="receipt-head-title">SUMMARY RECEIPT</span>
            <span className="receipt-badge">SSL SECURE CHECKOUT</span>
          </div>
          <div className="receipt-lines">
            <div className="receipt-line">
              <span>{selectedPlan?.name || 'Membership'} Plan Fee</span>
              <span>₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="receipt-line">
              <span>Slot Reservation & Facility Pass</span>
              <span className="receipt-free">Included</span>
            </div>
            <div className="receipt-line">
              <span>Digital Onboarding & QR Access</span>
              <span className="receipt-free">FREE</span>
            </div>
            <div className="receipt-divider" />
            <div className="receipt-line receipt-total">
              <div>
                <strong>Total Amount Payable</strong>
                <small>One-time payment • Immediate activation</small>
              </div>
              <strong className="receipt-price-total">₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions review-actions">
          <button type="button" className="outline-btn" onClick={() => setCurrentStep(4)}>
            <ArrowLeft size={16} /> Back
          </button>
          <button 
            type="button" 
            className="lime-btn review-pay-btn" 
            onClick={handleCompleteRegistration} 
            disabled={loading || !selectedPlan || !selectedSlot}
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={18} /> Processing Registration...</>
            ) : (
              <><ShieldCheck size={18} /> Complete Registration & Pay ₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')}</>
            )}
          </button>
        </div>

        {/* Security Footer Notes */}
        <div className="review-security-footer">
          <span><ShieldCheck size={13} /> 256-Bit Bank-Grade Encryption</span>
          <span>•</span>
          <span><CreditCard size={13} /> UPI / Cards / NetBanking</span>
          <span>•</span>
          <span><CheckCircle2 size={13} /> Instant Activation</span>
        </div>
      </div>
    );
  };

  return (
    <main className="auth-page registration-page">
      <section className="auth-art">
        <Brand onClick={() => navigate('/')} subtitle="UNISEX FITNESS STUDIO" size="md" />
        <div>
          <p className="eyebrow">JOIN VINO FITNESS STUDIO</p>
          <h1>BEGIN YOUR<br/><em>FITNESS JOURNEY.</em></h1>
          <p>Register in minutes and start your transformation at Vino Fitness Studio.</p>
        </div>
      </section>
      <section className="auth-form registration-form-container">
        <button className="back" onClick={() => navigate('/')}>
          <ArrowLeft/> Back to home
        </button>
        
        <div className="stepper">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            >
              <step.icon size={20} />
              <span>{step.title}</span>
            </div>
          ))}
        </div>

        {error && <div className="error-message">{error}</div>}

        {completed ? (
          <section className="review-step completed-step">
            <div className="completed-card">
              <div className="completed-icon-wrap">
                <Check size={48} />
              </div>
              <h2>{registrationStatus === 'completed' ? 'Membership Activated!' : 'Registration Saved — Ready for Payment'}</h2>
              <p className="completed-desc">
                {registrationStatus === 'completed' 
                  ? 'Your payment has been verified. Welcome to Vino Fitness Studio! Sign in to access your member dashboard.' 
                  : 'Your profile has been saved securely. Complete your Razorpay payment to activate your membership; biometrics are not required. Your requested slot is confirmed during activation.'}
              </p>
              
              <div className="completed-actions">
                {registrationStatus === 'completed' ? (
                  <button className="lime-btn" onClick={() => navigate('/login')}>
                    Sign in to Member Dashboard
                  </button>
                ) : (
                  <>
                    <button className="lime-btn pay-now-btn" disabled={loading} onClick={beginCheckout}>
                      <CreditCard size={18} /> Pay with Razorpay (₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')})
                    </button>
                    <button className="outline-btn" disabled={loading} onClick={restoreDraft}>
                      Refresh Payment Status
                    </button>
                  </>
                )}
              </div>
              {registrationStatus !== 'completed' && (
                <small className="completed-help">
                  If you closed the payment window, click "Pay with Razorpay" above to retry.
                </small>
              )}
            </div>
          </section>
        ) : resumeMode ? <form className="registration-form" onSubmit={resume}>
          <h2>Resume your registration</h2>
          <label>Email<input type="email" required value={basicData.email} onChange={e => setBasicData({ ...basicData, email: e.target.value })}/></label>
          <label>Password<input type="password" required value={basicData.password} onChange={e => setBasicData({ ...basicData, password: e.target.value })}/></label>
          <button className="lime-btn" disabled={loading}>Resume</button>
          <button type="button" className="outline-btn" onClick={() => setResumeMode(false)}>Back</button>
        </form> : <>{currentStep === 0 && <button className="outline-btn" onClick={() => setResumeMode(true)}>Already started? Resume registration</button>}{renderStep()}</>}

      </section>
    </main>
  );
}
