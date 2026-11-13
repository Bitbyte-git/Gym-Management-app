import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  CreditCard, 
  Sparkles, 
  Dumbbell, 
  Activity, 
  Flame, 
  Clock, 
  Calendar, 
  Award, 
  Zap, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const weightTrainingPlans = [
  {
    id: 'wt-monthly',
    name: 'Monthly',
    category: 'Weight Training',
    duration: '1 Month',
    months: 1,
    price: 800,
    priceFormatted: '₹800',
    admissionFee: 500,
    monthlyRate: '₹800/mo',
    desc: 'Pure strength & hypertrophy foundations',
    popular: false,
    facilities: [
      'Full weight training floor access',
      'Free weights, Olympic barbells & dumbbells',
      'Plate-loaded machines & cable stations',
      'Locker room & private shower access',
      'Biometric fingerprint attendance pass',
      'Morning (5-10 AM) or Evening (5-9 PM) access'
    ]
  },
  {
    id: 'wt-quarterly',
    name: 'Quarterly',
    category: 'Weight Training',
    duration: '3 Months',
    months: 3,
    price: 2000,
    priceFormatted: '₹2,000',
    admissionFee: 500,
    monthlyRate: '₹667/mo',
    savings: 'Save ₹400',
    desc: 'Structured muscle building & strength progression',
    popular: false,
    facilities: [
      'All Monthly Weight Training privileges',
      'Continuous 90-day progressive training',
      'Free weights, cables & squat cages',
      'Locker room & shower access',
      'Biometric kiosk check-in & attendance history',
      'Morning (5-10 AM) or Evening (5-9 PM) access'
    ]
  },
  {
    id: 'wt-half-yearly',
    name: 'Half-Yearly',
    category: 'Weight Training',
    duration: '6 Months',
    months: 6,
    price: 3500,
    priceFormatted: '₹3,500',
    admissionFee: 500,
    monthlyRate: '₹583/mo',
    savings: 'Save ₹1,300',
    badge: 'POPULAR CHOICE',
    popular: true,
    facilities: [
      'All Weight Training equipment & zones',
      'Long-term strength & physique transformation',
      'Full free weights, racks & cable stations',
      'Locker room & private shower access',
      '1 Complimentary 15-day membership freeze',
      'Biometric kiosk punch & mobile dashboard'
    ]
  },
  {
    id: 'wt-yearly',
    name: 'Yearly',
    category: 'Weight Training',
    duration: '12 Months',
    months: 12,
    price: 6000,
    priceFormatted: '₹6,000',
    admissionFee: 500,
    monthlyRate: '₹500/mo',
    savings: 'Save ₹3,600',
    badge: 'BEST VALUE (₹500/MO)',
    popular: false,
    facilities: [
      'Full 365 days of weight training access',
      'Unbeatable lowest monthly rate (₹500/month)',
      'All Olympic barbells, dumbbells & machines',
      'Locker room & shower access included',
      '1 Complimentary 30-day membership freeze',
      'Priority renewal privilege at locked rate'
    ]
  }
];

const cardioWeightPlans = [
  {
    id: 'cwt-monthly',
    name: 'Monthly',
    category: 'Cardio & Weight Training',
    duration: '1 Month',
    months: 1,
    price: 1500,
    priceFormatted: '₹1,500',
    admissionFee: 500,
    monthlyRate: '₹1,500/mo',
    desc: 'Complete muscle building plus cardio conditioning',
    popular: false,
    facilities: [
      'Full Cardio zone + Weight training floor',
      'Treadmills, cross-trainers & spin bikes',
      'Free weights, dumbbells & cable machines',
      'Fat-loss & endurance conditioning',
      'Locker room & private shower access',
      'Biometric fingerprint pass (Morning/Evening)'
    ]
  },
  {
    id: 'cwt-quarterly',
    name: 'Quarterly',
    category: 'Cardio & Weight Training',
    duration: '3 Months',
    months: 3,
    price: 3500,
    priceFormatted: '₹3,500',
    admissionFee: 500,
    monthlyRate: '₹1,167/mo',
    savings: 'Save ₹1,000',
    desc: 'Ideal for rapid fat-loss & physique toning',
    popular: false,
    facilities: [
      'Full access to all Cardio & Weight equipment',
      'Heart-rate elevated endurance sessions',
      'Barbells, dumbbells, cables & squat racks',
      'Locker room & private shower access',
      'Continuous progress & fitness tracking',
      'Biometric kiosk check-in at entrance'
    ]
  },
  {
    id: 'cwt-half-yearly',
    name: 'Half-Yearly',
    category: 'Cardio & Weight Training',
    duration: '6 Months',
    months: 6,
    price: 5500,
    priceFormatted: '₹5,500',
    admissionFee: 500,
    monthlyRate: '₹917/mo',
    savings: 'Save ₹3,500',
    badge: 'MOST POPULAR COMBO',
    popular: true,
    facilities: [
      'Comprehensive Cardio + Strength access',
      'Proven 6-month stamina & weight loss results',
      'All cardio machines, weights & functional gear',
      'Locker room & private shower access',
      '1 Complimentary 15-day membership freeze',
      'Biometric attendance & session statistics'
    ]
  },
  {
    id: 'cwt-yearly',
    name: 'Yearly',
    category: 'Cardio & Weight Training',
    duration: '12 Months',
    months: 12,
    price: 7500,
    priceFormatted: '₹7,500',
    admissionFee: 500,
    monthlyRate: '₹625/mo',
    savings: 'Save ₹10,500',
    badge: 'ULTIMATE SAVINGS (₹625/MO)',
    popular: false,
    facilities: [
      'Full 365 days unlimited Cardio & Weights',
      'Massive savings — under ₹21 per day!',
      'All cardio machinery, Olympic weights & cables',
      'Locker room & shower access included',
      '1 Complimentary 30-day membership freeze',
      'Priority slot preference & annual recognition'
    ]
  }
];

const personalTraining = {
  name: 'Personal Training',
  tagline: '1-on-1 Dedicated Coaching',
  price: 4000,
  priceFormatted: '₹4,000',
  sessions: '16 Classes',
  validity: '30 Days Maximum',
  desc: 'Accelerate your transformation with specialized individual coaching, technique correction, and personalized progressive overload.',
  highlights: [
    '16 Dedicated 1-on-1 coaching sessions',
    'Customized workout split tailored to your goals',
    'Strict form assessment & injury prevention',
    'Personalized nutrition & diet guidance',
    'Body measurements & body fat progression audits',
    'Valid for 30 days from session activation'
  ]
};

export default function Memberships() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'weight' | 'cardio' | 'pt'

  const displayPlans = activeCategory === 'weight'
    ? weightTrainingPlans
    : activeCategory === 'cardio'
    ? cardioWeightPlans
    : [...weightTrainingPlans, ...cardioWeightPlans];

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        {/* Hero Section */}
        <div className="page-hero" style={{ textAlign: 'center', marginBottom: '28px' }}>
          <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CreditCard size={14} color="var(--lime)" /> OFFICIAL RATES • VINO FITNESS STUDIO
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.02em', margin: '8px 0 14px' }}>
            CHOOSE YOUR MEMBERSHIP & <em style={{ color: 'var(--lime)', fontStyle: 'normal' }}>START TODAY</em>
          </h1>
          <p className="lead-text" style={{ maxWidth: '720px', margin: '0 auto', fontSize: '15px', color: '#9ba58f', lineHeight: 1.6 }}>
            Transparent pricing with zero hidden maintenance charges. Choose from specialized Weight Training, combined Cardio & Weights, or 1-on-1 Personal Training.
          </p>
        </div>

        {/* Studio Operating Hours & Admission Strip */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px',
            maxWidth: '1050px',
            margin: '0 auto 34px',
            padding: '16px 20px',
            background: 'linear-gradient(145deg, #121a0d, #090e06)',
            border: '1px solid #23331b',
            borderRadius: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(198,255,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#858d7e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Studio Class Timings
              </div>
              <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                Morning: <span style={{ color: 'var(--lime)' }}>5:00 AM – 10:00 AM</span> • Evening: <span style={{ color: 'var(--lime)' }}>5:00 PM – 9:00 PM</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#858d7e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Admission Policy
              </div>
              <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                One-time Admission: <span style={{ color: '#f87171' }}>₹500</span> (Non-Refundable)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(198,255,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#858d7e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Personal Coaching
              </div>
              <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                16 Classes: <span style={{ color: 'var(--lime)' }}>₹4,000</span> (30 Days Max)
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '32px' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '10px 22px',
              borderRadius: '30px',
              border: activeCategory === 'all' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: activeCategory === 'all' ? 'var(--lime)' : '#0d130a',
              color: activeCategory === 'all' ? '#090e06' : '#c9d1c2',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={15} /> All Plans
          </button>
          <button
            onClick={() => setActiveCategory('weight')}
            style={{
              padding: '10px 22px',
              borderRadius: '30px',
              border: activeCategory === 'weight' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: activeCategory === 'weight' ? 'var(--lime)' : '#0d130a',
              color: activeCategory === 'weight' ? '#090e06' : '#c9d1c2',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Dumbbell size={15} /> Weight Training (From ₹800/mo)
          </button>
          <button
            onClick={() => setActiveCategory('cardio')}
            style={{
              padding: '10px 22px',
              borderRadius: '30px',
              border: activeCategory === 'cardio' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: activeCategory === 'cardio' ? 'var(--lime)' : '#0d130a',
              color: activeCategory === 'cardio' ? '#090e06' : '#c9d1c2',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Flame size={15} /> Cardio & Weight Training (From ₹1,500/mo)
          </button>
          <button
            onClick={() => setActiveCategory('pt')}
            style={{
              padding: '10px 22px',
              borderRadius: '30px',
              border: activeCategory === 'pt' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: activeCategory === 'pt' ? 'var(--lime)' : '#0d130a',
              color: activeCategory === 'pt' ? '#090e06' : '#c9d1c2',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Award size={15} /> Personal Training (₹4,000)
          </button>
        </div>

        {/* 1-on-1 Personal Training Banner (Visible on 'all' and 'pt') */}
        {(activeCategory === 'all' || activeCategory === 'pt') && (
          <div 
            style={{
              maxWidth: '1100px',
              margin: '0 auto 40px',
              padding: '30px 28px',
              background: 'linear-gradient(135deg, #1b2612 0%, #0d140a 100%)',
              border: '1px solid #364d26',
              borderRadius: '18px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '28px',
                alignItems: 'center' 
              }}
            >
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(198,255,0,0.15)', color: 'var(--lime)', fontSize: '11px', fontWeight: 800, padding: '5px 14px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                  <Award size={14} /> 1-on-1 Direct Mentorship
                </div>
                <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#ffffff', margin: '0 0 10px', fontWeight: 800 }}>
                  PERSONAL TRAINING <span style={{ color: 'var(--lime)' }}>₹4,000/-</span>
                </h2>
                <p style={{ fontSize: '14px', color: '#cbd5c0', margin: '0 0 16px', lineHeight: 1.6 }}>
                  {personalTraining.desc}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
                  <div style={{ background: '#0a0e08', padding: '10px 16px', borderRadius: '10px', border: '1px solid #23331b' }}>
                    <div style={{ fontSize: '11px', color: '#858d7e' }}>SESSIONS</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>16 Classes</div>
                  </div>
                  <div style={{ background: '#0a0e08', padding: '10px 16px', borderRadius: '10px', border: '1px solid #23331b' }}>
                    <div style={{ fontSize: '11px', color: '#858d7e' }}>VALIDITY</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--lime)' }}>30 Days Maximum</div>
                  </div>
                  <div style={{ background: '#0a0e08', padding: '10px 16px', borderRadius: '10px', border: '1px solid #23331b' }}>
                    <div style={{ fontSize: '11px', color: '#858d7e' }}>ADMISSION</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#f87171' }}>Non-Refundable</div>
                  </div>
                </div>
                <button
                  className="lime-btn"
                  style={{ height: '44px', padding: '0 28px', fontSize: '13px', fontWeight: 700 }}
                  onClick={() => navigate('/register')}
                >
                  Book Personal Training <ArrowRight size={15} />
                </button>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '14px', border: '1px solid #23331b' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--lime)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                  What's Included in 16 Classes:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
                  {personalTraining.highlights.map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#e2e7dc' }}>
                      <Check size={16} color="var(--lime)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: WEIGHT TRAINING (When 'all' or 'weight') */}
        {(activeCategory === 'all' || activeCategory === 'weight') && (
          <div style={{ marginBottom: '50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', maxWidth: '1100px', margin: '0 auto 20px', borderBottom: '1px solid #1c2715', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--lime)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <Dumbbell size={15} /> Core Strength & Hypertrophy
                </div>
                <h2 style={{ fontSize: '26px', color: '#ffffff', margin: '4px 0 0', fontWeight: 800 }}>
                  WEIGHT TRAINING PLANS
                </h2>
              </div>
              <div style={{ fontSize: '12px', color: '#9ba58f', background: '#0e150b', padding: '6px 14px', borderRadius: '20px', border: '1px solid #23331b' }}>
                Admission Fee: <strong style={{ color: '#ffffff' }}>₹500</strong> (Non-refundable)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
              {weightTrainingPlans.map((p) => (
                <div
                  key={p.id}
                  className={'interactive-card ' + (p.popular ? 'popular' : '')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: p.popular ? 'var(--lime)' : '#202a16',
                    background: p.popular ? 'linear-gradient(145deg, #121a0d, #080b07)' : '#080b07',
                    position: 'relative',
                    padding: '28px 22px',
                    borderRadius: '16px'
                  }}
                >
                  {(p.popular || p.badge) && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-11px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--lime)',
                        color: '#101400',
                        fontSize: '9px',
                        fontWeight: 900,
                        padding: '4px 14px',
                        borderRadius: '12px',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.badge || 'POPULAR CHOICE'}
                    </span>
                  )}

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '0 0 4px', fontWeight: 700 }}>{p.name}</h3>
                      {p.savings && (
                        <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 800, background: 'rgba(198,255,0,0.12)', padding: '2px 8px', borderRadius: '8px' }}>
                          {p.savings}
                        </span>
                      )}
                    </div>
                    <small style={{ fontSize: '12px', color: '#858d7e' }}>{p.desc}</small>
                  </div>

                  <div style={{ margin: '8px 0 14px' }}>
                    <strong style={{ fontSize: '32px', color: '#ffffff', fontWeight: 900 }}>{p.priceFormatted}</strong>
                    <span style={{ fontSize: '13px', color: '#a5ada0', marginLeft: '6px' }}>/ {p.duration}</span>
                    <div style={{ fontSize: '11px', color: 'var(--lime)', marginTop: '4px', fontWeight: 600 }}>
                      Effective: {p.monthlyRate}
                    </div>
                    <div style={{ fontSize: '10px', color: '#7a8573', marginTop: '2px' }}>
                      + ₹{p.admissionFee} one-time admission
                    </div>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '10px', flexGrow: 1 }}>
                    {p.facilities.map((fac, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#d5decb', lineHeight: 1.4 }}>
                        <Check size={14} color="var(--lime)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{fac}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={p.popular ? 'lime-btn' : 'ghost-btn'}
                    style={{ width: '100%', height: '42px', fontSize: '12px', fontWeight: 700, justifyContent: 'center' }}
                    onClick={() => navigate('/register')}
                  >
                    Join {p.name} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: CARDIO & WEIGHT TRAINING (When 'all' or 'cardio') */}
        {(activeCategory === 'all' || activeCategory === 'cardio') && (
          <div style={{ marginBottom: '50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', maxWidth: '1100px', margin: '0 auto 20px', borderBottom: '1px solid #1c2715', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#facc15', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <Flame size={15} /> All-Inclusive Conditioning
                </div>
                <h2 style={{ fontSize: '26px', color: '#ffffff', margin: '4px 0 0', fontWeight: 800 }}>
                  CARDIO & WEIGHT TRAINING PLANS
                </h2>
              </div>
              <div style={{ fontSize: '12px', color: '#9ba58f', background: '#0e150b', padding: '6px 14px', borderRadius: '20px', border: '1px solid #23331b' }}>
                Admission Fee: <strong style={{ color: '#ffffff' }}>₹500</strong> (Non-refundable)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
              {cardioWeightPlans.map((p) => (
                <div
                  key={p.id}
                  className={'interactive-card ' + (p.popular ? 'popular' : '')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: p.popular ? 'var(--lime)' : '#202a16',
                    background: p.popular ? 'linear-gradient(145deg, #151f10, #080b07)' : '#080b07',
                    position: 'relative',
                    padding: '28px 22px',
                    borderRadius: '16px'
                  }}
                >
                  {(p.popular || p.badge) && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-11px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--lime)',
                        color: '#101400',
                        fontSize: '9px',
                        fontWeight: 900,
                        padding: '4px 14px',
                        borderRadius: '12px',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.badge || 'POPULAR CHOICE'}
                    </span>
                  )}

                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '0 0 4px', fontWeight: 700 }}>{p.name}</h3>
                      {p.savings && (
                        <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 800, background: 'rgba(198,255,0,0.12)', padding: '2px 8px', borderRadius: '8px' }}>
                          {p.savings}
                        </span>
                      )}
                    </div>
                    <small style={{ fontSize: '12px', color: '#858d7e' }}>{p.desc}</small>
                  </div>

                  <div style={{ margin: '8px 0 14px' }}>
                    <strong style={{ fontSize: '32px', color: '#ffffff', fontWeight: 900 }}>{p.priceFormatted}</strong>
                    <span style={{ fontSize: '13px', color: '#a5ada0', marginLeft: '6px' }}>/ {p.duration}</span>
                    <div style={{ fontSize: '11px', color: 'var(--lime)', marginTop: '4px', fontWeight: 600 }}>
                      Effective: {p.monthlyRate}
                    </div>
                    <div style={{ fontSize: '10px', color: '#7a8573', marginTop: '2px' }}>
                      + ₹{p.admissionFee} one-time admission
                    </div>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '10px', flexGrow: 1 }}>
                    {p.facilities.map((fac, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#d5decb', lineHeight: 1.4 }}>
                        <Check size={14} color="var(--lime)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{fac}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={p.popular ? 'lime-btn' : 'ghost-btn'}
                    style={{ width: '100%', height: '42px', fontSize: '12px', fontWeight: 700, justifyContent: 'center' }}
                    onClick={() => navigate('/register')}
                  >
                    Join {p.name} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rate Card Matrix Table */}
        <div style={{ maxWidth: '1100px', margin: '0 auto 40px', background: '#0a0e08', border: '1px solid #1f2c18', borderRadius: '16px', padding: '28px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', color: 'var(--lime)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              OFFICIAL STUDIO RATE CARD
            </div>
            <h3 style={{ fontSize: '22px', color: '#ffffff', margin: '4px 0 6px', fontWeight: 800 }}>
              Quick Price Comparison Matrix
            </h3>
            <p style={{ fontSize: '13px', color: '#8c9684', margin: 0 }}>
              Compare rates across durations for Weight Training vs Cardio & Weight Training.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #23331b' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: '#858d7e', textTransform: 'uppercase' }}>Duration</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--lime)', textTransform: 'uppercase' }}>Weight Training</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: '#facc15', textTransform: 'uppercase' }}>Cardio & Weight Training</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: '#f87171', textTransform: 'uppercase' }}>Admission Fee</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', color: '#cbd5c0', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #162012' }}>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 600 }}>Monthly (1 Month)</td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹800</td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹1,500</td>
                  <td style={{ padding: '14px 16px', color: '#f87171' }}>₹500 (one-time)</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="ghost-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => navigate('/register')}>Select</button>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #162012' }}>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 600 }}>Quarterly (3 Months)</td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹2,000 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>(Save ₹400)</span></td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹3,500 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>(Save ₹1,000)</span></td>
                  <td style={{ padding: '14px 16px', color: '#f87171' }}>₹500 (one-time)</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="ghost-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => navigate('/register')}>Select</button>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #162012', background: 'rgba(198,255,0,0.02)' }}>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 600 }}>Half-Yearly (6 Months)</td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹3,500 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>(Save ₹1,300)</span></td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹5,500 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>(Save ₹3,500)</span></td>
                  <td style={{ padding: '14px 16px', color: '#f87171' }}>₹500 (one-time)</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="lime-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => navigate('/register')}>Select</button>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #162012' }}>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 600 }}>Yearly (12 Months)</td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹6,000 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>Best Value (₹500/mo)</span></td>
                  <td style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>₹7,500 <span style={{ fontSize: '10px', color: 'var(--lime)' }}>Best Value (₹625/mo)</span></td>
                  <td style={{ padding: '14px 16px', color: '#f87171' }}>₹500 (one-time)</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="lime-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => navigate('/register')}>Select</button>
                  </td>
                </tr>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '14px 16px', color: 'var(--lime)', fontWeight: 700 }}>Personal Training</td>
                  <td colSpan="2" style={{ padding: '14px 16px', color: '#ffffff', fontWeight: 700 }}>
                    ₹4,000 / 16 Classes <span style={{ fontSize: '11px', color: '#858d7e' }}>(30 Days Maximum Validity)</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#f87171' }}>Non-Refundable</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="ghost-btn" style={{ padding: '6px 14px', fontSize: '11px' }} onClick={() => navigate('/register')}>Select</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Member Trust Banner */}
        <div className="pricing-trust-strip" style={{ maxWidth: '950px', margin: '0 auto 30px' }}>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} color="var(--lime)" /> Biometric Fingerprint Kiosk
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} color="var(--lime)" /> Locker & Shower Included
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} color="var(--lime)" /> Morning (5-10am) & Evening (5-9pm)
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} color="var(--lime)" /> Instant Razorpay UPI Activation
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
