import { useNavigate } from 'react-router-dom';
import {
  Dumbbell, QrCode, HeartPulse, ShieldCheck, Flame, Coffee,
  ArrowRight, CheckCircle2, Sparkles
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const facilitiesList = [
  {
    icon: Dumbbell,
    title: 'Olympic Lifting & Power Racks',
    tag: 'Heavy Strength',
    desc: 'Heavy-duty competition cages, Olympic barbells, deadlift platforms, and bumper plates calibrated for serious powerlifting and hypertrophy.'
  },
  {
    icon: QrCode,
    title: 'Smart Biometric & QR Check-in',
    tag: 'Instant Access',
    desc: '0.3s sub-second check-in using your fingerprint or personal mobile QR pass. Walk in and start lifting with zero front-desk queueing.'
  },
  {
    icon: HeartPulse,
    title: 'High-Output Cardio Deck',
    tag: 'Conditioning',
    desc: 'Concept2 rowers, SkiErgs, assault air bikes, and curved treadmills designed for high-intensity interval conditioning and stamina.'
  },
  {
    icon: Flame,
    title: 'Dumbbell & Cable Bays',
    tag: 'Hypertrophy',
    desc: 'Solid steel dumbbells ranging from 2.5kg up to 50kg, multi-station dual cable crossovers, and plate-loaded ISO machines.'
  },
  {
    icon: ShieldCheck,
    title: 'Private Showers & Lockers',
    tag: 'Luxury Amenities',
    desc: 'Spacious daily lockers, private high-pressure hot & cold rain showers, vanity mirrors, and secure keyless access.'
  },
  {
    icon: Coffee,
    title: 'Protein & Fuel Bar',
    tag: 'Nutrition & Recovery',
    desc: 'Grab post-workout whey shakes, BCAA hydration, electrolytes, pre-workout espressos, and healthy protein snacks on your way out.'
  }
];

export default function Facilities() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><Dumbbell size={14} /> WORLD-CLASS AMENITIES</p>
          <h1>DESIGNED FOR PERFORMANCE. <em>BUILT TO INSPIRE.</em></h1>
          <p className="lead-text">
            Every square foot of Vino Fitness Studio is engineered to deliver the best training session of your day.
          </p>
        </div>

        {/* 6 Minimal Facility Cards */}
        <div className="minimal-grid-3" style={{ maxWidth: '980px', margin: '0 auto 40px' }}>
          {facilitiesList.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="minimal-card">
                <div className="minimal-card-top">
                  <div className="minimal-card-icon"><Icon size={20} /></div>
                  <span className="minimal-card-badge">{f.tag}</span>
                </div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Studio Tour Invite Card */}
        <div className="interactive-card" style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, letterSpacing: '0.1em' }}>
            STUDIO EXPERIENCE
          </span>
          <h3 style={{ fontSize: '22px', color: '#ffffff', margin: '6px 0 10px' }}>Experience the Studio in Person</h3>
          <p style={{ fontSize: '13px', color: '#a5ada0', maxWidth: '580px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            Visit Vino Fitness Studio at Race Course Road, Coimbatore. Meet our coaching team, check out the lifting platforms, and claim your free trial pass.
          </p>

          <div style={{ display: 'inline-flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="ghost-btn" onClick={() => navigate('/contact')}>
              Book Studio Walkthrough
            </button>
            <button className="lime-btn" onClick={() => navigate('/register')}>
              Join as Member <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

