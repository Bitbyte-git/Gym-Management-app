import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, Award } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../luxury-pages.css';

const weightPlans = [
  {
    id: 'wt-monthly',
    name: 'Monthly',
    duration: '1 Month',
    price: '₹800',
    rate: '₹800/mo',
    desc: 'Pure strength foundations with zero long-term contract.',
    points: [
      'Full weight training floor access',
      'Free weights, Olympic barbells & dumbbells',
      'Locker room & private rain showers',
      'Biometric touchless kiosk check-in'
    ]
  },
  {
    id: 'wt-quarterly',
    name: 'Quarterly',
    duration: '3 Months',
    price: '₹2,000',
    rate: '₹667/mo',
    savings: 'Save ₹400',
    desc: 'Structured 90-day progressive overload and muscle building.',
    points: [
      'Continuous 90-day progressive lifting',
      'Free weights, cables & squat cages',
      'Locker room & private shower access',
      'Biometric check-in & workout tracking'
    ]
  },
  {
    id: 'wt-half-yearly',
    name: 'Half-Yearly',
    duration: '6 Months',
    price: '₹3,500',
    rate: '₹583/mo',
    savings: 'Save ₹1,300',
    featured: true,
    badge: 'POPULAR',
    desc: 'Six months of progressive hypertrophy and physical transformation.',
    points: [
      'All Weight Training equipment & zones',
      'Long-term strength & physique progress',
      '1 Complimentary 15-day membership freeze',
      'Locker room & shower access included'
    ]
  },
  {
    id: 'wt-yearly',
    name: 'Yearly',
    duration: '12 Months',
    price: '₹6,000',
    rate: '₹500/mo',
    savings: 'Save ₹3,600',
    badge: 'BEST VALUE',
    desc: 'The ultimate commitment. Unbeatable rate at just ₹500 per month.',
    points: [
      'Full 365 days of strength access',
      'Lowest monthly rate (₹500/month)',
      '1 Complimentary 30-day membership freeze',
      'Priority renewal at locked pricing'
    ]
  }
];

const cardioPlans = [
  {
    id: 'cwt-monthly',
    name: 'Monthly',
    duration: '1 Month',
    price: '₹1,500',
    rate: '₹1,500/mo',
    desc: 'Complete conditioning with full cardio and strength access.',
    points: [
      'Full Cardio deck + Weight floor',
      'Treadmills, cross-trainers & spin bikes',
      'Fat loss & stamina pacing circuits',
      'Locker room & private rain showers'
    ]
  },
  {
    id: 'cwt-quarterly',
    name: 'Quarterly',
    duration: '3 Months',
    price: '₹3,500',
    rate: '₹1,167/mo',
    savings: 'Save ₹1,000',
    desc: 'Ideal for accelerated fat reduction and athletic conditioning.',
    points: [
      'Full Cardio suite & Olympic strength bays',
      'Structured cardio interval pacing',
      'Locker room & private shower access',
      'Biometric check-in & session stats'
    ]
  },
  {
    id: 'cwt-half-yearly',
    name: 'Half-Yearly',
    duration: '6 Months',
    price: '₹5,500',
    rate: '₹917/mo',
    savings: 'Save ₹3,500',
    featured: true,
    badge: 'POPULAR COMBO',
    desc: 'Proven 6-month stamina and complete body recomposition.',
    points: [
      'Full access to all Cardio & Weight gear',
      '1 Complimentary 15-day membership freeze',
      'Locker room & private shower access',
      'Biometric pass & attendance history'
    ]
  },
  {
    id: 'cwt-yearly',
    name: 'Yearly',
    duration: '12 Months',
    price: '₹7,500',
    rate: '₹625/mo',
    savings: 'Save ₹10,500',
    badge: 'BEST VALUE',
    desc: 'Full 365 days unlimited Cardio & Weights. Under ₹21 per day.',
    points: [
      'Full 365-day studio access',
      'Massive savings (Only ₹625/month)',
      '1 Complimentary 30-day membership freeze',
      'Biometric kiosk access & all amenities'
    ]
  }
];

const ptData = {
  price: '₹4,000',
  sessions: '16 Classes',
  validity: '30 Days Maximum',
  subtitle: 'Individual 1-on-1 coaching for accelerated athletic progress.',
  points: [
    '16 Dedicated 1-on-1 coaching sessions',
    'Customized progressive overload workout split',
    'Strict biomechanical form assessment',
    'Targeted nutritional and dietary guidance',
    'Body composition progression tracking',
    'Valid for 30 days from session activation'
  ]
};

export default function Memberships() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('weight'); // 'weight' | 'cardio' | 'pt'

  const activePlans = tab === 'weight' ? weightPlans : cardioPlans;

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-page-wrap">
          <div className="luxury-ambient-glow" />

          {/* Minimal Hero */}
          <div className="luxury-hero">
            <span className="luxury-badge">Memberships</span>
            <h1 className="luxury-title">
              The <span>Plans</span>.
            </h1>
            <p className="luxury-lead">
              Transparent rates with zero hidden fees. Pure strength or combined cardio conditioning.
            </p>
          </div>

          {/* Segmented Control */}
          <div className="luxury-segmented-track">
            <button
              className={`luxury-segment-btn ${tab === 'weight' ? 'active' : ''}`}
              onClick={() => setTab('weight')}
            >
              Weight Training
            </button>
            <button
              className={`luxury-segment-btn ${tab === 'cardio' ? 'active' : ''}`}
              onClick={() => setTab('cardio')}
            >
              Cardio & Weight
            </button>
            <button
              className={`luxury-segment-btn ${tab === 'pt' ? 'active' : ''}`}
              onClick={() => setTab('pt')}
            >
              Personal Training
            </button>
          </div>

          {/* Personal Training View */}
          {tab === 'pt' ? (
            <div className="luxury-spotlight-card">
              <div style={{ maxWidth: '520px' }}>
                <span className="luxury-card-tag">1-on-1 Dedicated Coaching</span>
                <div className="luxury-card-price" style={{ margin: '4px 0 12px' }}>
                  {ptData.price} <span>/ 16 Classes</span>
                </div>
                <p className="luxury-card-desc" style={{ marginBottom: '24px' }}>
                  {ptData.subtitle} Valid for {ptData.validity}. Admission fees non-refundable.
                </p>
                <button className="luxury-btn-primary" onClick={() => navigate('/register')}>
                  Book Personal Coaching <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', minWidth: '300px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--lime)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
                  What's Included
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ptData.points.map((p, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d1d1d6' }}>
                      <Check size={14} color="var(--lime)" style={{ flexShrink: 0 }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            /* 4 Clean Glass Plan Cards */
            <div className="luxury-grid-4">
              {activePlans.map((p) => (
                <div
                  key={p.id}
                  className={`luxury-glass-card ${p.featured ? 'is-featured' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span className="luxury-card-tag">{p.duration}</span>
                    {p.badge && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--lime)', letterSpacing: '0.06em' }}>
                        {p.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="luxury-card-title">{p.name}</h3>
                  <div className="luxury-card-price">
                    {p.price} <span>/ {p.duration}</span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--lime)', fontWeight: 500, marginBottom: '8px' }}>
                    {p.rate} {p.savings && `• ${p.savings}`}
                  </div>

                  <p className="luxury-card-desc">{p.desc}</p>

                  <ul className="luxury-card-points">
                    {p.points.map((pt, idx) => (
                      <li key={idx}>
                        <Check size={13} />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={p.featured ? 'luxury-btn-primary' : 'luxury-btn-ghost'}
                    style={{ width: '100%' }}
                    onClick={() => navigate('/register')}
                  >
                    Join {p.name} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Minimalist Note Bar */}
          <div className="luxury-note-bar">
            One-time admission fee: <strong>₹500 (Non-refundable)</strong> • Classes: <strong>Morning 5–10 AM</strong> & <strong>Evening 5–9 PM</strong>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
