import { useNavigate } from 'react-router-dom';
import { Dumbbell, QrCode, HeartPulse, ShieldCheck, Flame, Coffee, ArrowRight } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../luxury-pages.css';

const facilities = [
  {
    icon: Dumbbell,
    title: 'Olympic Platforms & Racks',
    tag: 'Heavy Strength',
    desc: 'Heavy-duty competition cages, Eleiko Olympic bars, deadlift platforms, and competition bumper plates.'
  },
  {
    icon: QrCode,
    title: 'Touchless Biometric Access',
    tag: 'Sub-Second Entry',
    desc: '0.3-second fingerprint kiosk and personal QR verification. Enter and train with zero desk delays.'
  },
  {
    icon: HeartPulse,
    title: 'Cardio Endurance Deck',
    tag: 'Conditioning Suite',
    desc: 'Concept2 rowers, SkiErgs, assault air bikes, and commercial treadmills calibrated for interval conditioning.'
  },
  {
    icon: Flame,
    title: 'Dumbbell & ISO Bays',
    tag: 'Hypertrophy',
    desc: 'Machined steel dumbbells ranging from 2.5kg to 50kg, dual cable crossovers, and plate-loaded machines.'
  },
  {
    icon: ShieldCheck,
    title: 'Private Rain Showers & Lockers',
    tag: 'Luxury Amenities',
    desc: 'Spacious personal day lockers, high-pressure hot and cold rain showers, and sanitized change suites.'
  },
  {
    icon: Coffee,
    title: 'Recovery & Nutrition Lounge',
    tag: 'Fuel & Rehydration',
    desc: 'Post-workout whey shakes, hydration electrolytes, pre-workout espresso, and high-protein nutrition snacks.'
  }
];

export default function Facilities() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-page-wrap">
          <div className="luxury-ambient-glow" />

          {/* Minimal Hero */}
          <div className="luxury-hero">
            <span className="luxury-badge">Amenities</span>
            <h1 className="luxury-title">
              The <span>Studio</span>.
            </h1>
            <p className="luxury-lead">
              Precision engineered for performance. Calibrated equipment, pristine hygiene, and zero compromise.
            </p>
          </div>

          {/* 6 Luxury Glass Cards Grid */}
          <div className="luxury-grid-3">
            {facilities.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} className="luxury-glass-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Icon size={20} />
                    </div>
                    <span className="luxury-card-tag" style={{ margin: 0 }}>{f.tag}</span>
                  </div>

                  <h3 className="luxury-card-title" style={{ fontSize: '18px', marginBottom: '8px' }}>
                    {f.title}
                  </h3>

                  <p className="luxury-card-desc" style={{ marginBottom: 0, fontSize: '13px', lineHeight: '1.5' }}>
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Bottom Luxury Action Card */}
          <div className="luxury-floating-bar" style={{ marginTop: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Experience Vino Studio</span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#f5f5f7' }}>Claim a Complimentary 1-Day Trial Pass</span>
            </div>
            <button className="luxury-btn-primary" onClick={() => navigate('/contact')}>
              Request Pass <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
