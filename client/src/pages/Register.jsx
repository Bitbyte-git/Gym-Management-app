import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, User, Heart, CreditCard, Calendar, UserCheck } from 'lucide-react';
import { registrationService } from '../services';
import { openRazorpayCheckout } from '../services/razorpay';
import { Brand } from '../components/Brand';

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
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
      <label className="remember"><input type="checkbox" required checked={healthConsent} onChange={e => setHealthConsent(e.target.checked)}/> I consent to the gym storing my health and fitness information for my membership.</label>
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

  const renderReview = () => (
    <div className="review-step">
      <h2>Review Your Registration</h2>
      <p>Fingerprint enrollment is not required. Save your registration, then pay securely with Razorpay. Your membership activates after payment verification. Capacity is confirmed during activation.</p>
      <div className="review-content">
        <div className="review-section">
          <h3>Personal Details</h3>
          <p><strong>Name:</strong> {basicData.firstName} {basicData.lastName}</p>
          <p><strong>Email:</strong> {basicData.email}</p>
          <p><strong>Mobile:</strong> {basicData.mobile}</p>
          <p><strong>DOB:</strong> {basicData.dateOfBirth}</p>
        </div>
        <div className="review-section">
          <h3>Health Details</h3>
          <p><strong>Height:</strong> {healthData.height} cm</p>
          <p><strong>Weight:</strong> {healthData.weight} kg</p>
          <p><strong>Fitness Goal:</strong> {healthData.fitnessGoal}</p>
        </div>
        <div className="review-section">
          <h3>Membership</h3>
          <p><strong>Plan:</strong> {selectedPlan?.name}</p>
          <p><strong>Price:</strong> ₹{selectedPlan?.price}</p>
          <p><strong>Requested time slot:</strong> {selectedSlot?.name} ({selectedSlot?.startTime} - {selectedSlot?.endTime})</p>
          {selectedTrainer && <p><strong>Trainer:</strong> {selectedTrainer.fullName}</p>}
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="outline-btn" onClick={() => setCurrentStep(4)}>
          <ArrowLeft/> Back
        </button>
        <button className="lime-btn" onClick={handleCompleteRegistration} disabled={loading || !selectedPlan || !selectedSlot}>
          {loading ? <><Loader2 className="animate-spin"/> Processing...</> : <>Complete Registration</>}
        </button>
      </div>
    </div>
  );

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
          <section className="review-step">
            <Check size={56} style={{ color: 'var(--lime)' }} />
            <h2>{registrationStatus === 'completed' ? 'Membership activated' : 'Registration saved - payment pending'}</h2>
            {registrationStatus === 'completed' ? <>
              <p>Your payment has been verified. Sign in to access your member dashboard.</p>
              <button className="lime-btn" onClick={() => navigate('/login')}>Sign in</button>
            </> : <>
              <p>Your details are saved securely. Complete Razorpay payment to activate your membership; biometrics are not required. Your requested slot is confirmed during activation.</p>
              <button className="lime-btn" disabled={loading} onClick={beginCheckout}>Pay with Razorpay</button>
              <button className="outline-btn" disabled={loading} onClick={restoreDraft}>Refresh payment status</button>
              <p>If you closed Checkout, you can retry payment. If payment was taken but activation is pending, contact reception before paying again.</p>
            </>}

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
