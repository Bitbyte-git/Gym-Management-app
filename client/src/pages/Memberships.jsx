import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, CheckCircle2, ShieldCheck, CreditCard, Sparkles } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const membershipPlans = [
  {
    id: 'basic',
    name: 'Basic',
    duration: '1 Month',
    price: '₹999',
    desc: 'Perfect for beginners starting their fitness journey',
    facilities: [
      'Full gym access during allocated slot',
      'Free weights, cables & cardio machines',
      'Locker room & private shower access',
      'Free studio parking'
    ]
  },
  {
    id: 'standard',
    name: 'Standard',
    duration: '3 Months',
    price: '₹2,499',
    desc: 'Best value for regular gym-goers',
    popular: false,
    facilities: [
      'Full gym floor access',
      'All strength & Olympic lifting platforms',
      'Locker room, showers & sauna',
      'Group HIIT and Yoga class access',
      'Initial body composition assessment'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    duration: '6 Months',
    price: '₹4,499',
    desc: 'For serious fitness enthusiasts',
    popular: true,
    facilities: [
      'All Standard tier privileges',
      'Personal trainer strategy consultation',
      'Customized workout & macro guide',
      '2 Monthly complimentary guest passes',
      'Free 30-day membership freeze option'
    ]
  },
  {
    id: 'annual',
    name: 'Annual Elite',
    duration: '12 Months',
    price: '₹7,999',
    desc: 'Best value for committed athletes',
    popular: false,
    badge: 'BEST ANNUAL VALUE',
    facilities: [
      'Full 365-day studio access',
      'All Premium facilities included',
      'Quarterly 1-on-1 nutrition audits',
      'Priority peak time-slot booking',
      'Up to 60-day membership freeze',
      'Complimentary Vino Fitness Studio Athlete Kit'
    ]
  }
];

export default function Memberships() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><CreditCard size={14} /> TRANSPARENT MEMBERSHIPS</p>
          <h1>CHOOSE YOUR MEMBERSHIP & <em>START TODAY</em></h1>
          <p className="lead-text">
            No registration fees. No hidden locker charges. Register online in 2 minutes, pay securely with UPI or card, and start training immediately.
          </p>
        </div>

        {/* 4 Database Plans Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto 40px' }}>
          {membershipPlans.map((p) => {
            return (
              <div
                key={p.id}
                className={'interactive-card ' + (p.popular ? 'popular' : '')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: p.popular ? 'var(--lime)' : '#202a16',
                  background: p.popular ? 'linear-gradient(145deg, #121a0d, #080b07)' : '#080b07',
                  position: 'relative',
                  padding: '26px 20px'
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
                      fontWeight: 800,
                      padding: '4px 14px',
                      borderRadius: '12px',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {p.badge || 'MOST POPULAR'}
                  </span>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '0 0 4px' }}>{p.name}</h3>
                  <small style={{ fontSize: '11px', color: '#858d7e' }}>{p.desc}</small>
                </div>

                <div style={{ margin: '12px 0 16px' }}>
                  <strong style={{ fontSize: '32px', color: '#ffffff', fontWeight: 800 }}>{p.price}</strong>
                  <span style={{ fontSize: '12px', color: '#a5ada0', marginLeft: '6px' }}>/ {p.duration}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '9px', flexGrow: 1 }}>
                  {p.facilities.map((fac, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#e2e7dc' }}>
                      <Check size={14} color="var(--lime)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{fac}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={p.popular ? 'lime-btn' : 'ghost-btn'}
                  style={{ width: '100%', height: '40px', fontSize: '12px', justifyContent: 'center' }}
                  onClick={() => navigate('/register')}
                >
                  Join {p.name} <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Member Trust Banner */}
        <div className="pricing-trust-strip" style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} /> Instant Razorpay UPI Activation
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} /> Free Biometric / QR Kiosk Pass
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} /> Locker & Shower Included
          </div>
          <div className="pricing-trust-item">
            <CheckCircle2 size={16} /> Membership Freeze Support
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

