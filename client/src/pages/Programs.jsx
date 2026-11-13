import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Flame, Zap, Users, HeartPulse, ArrowRight, Check } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../luxury-pages.css';

const programs = [
  {
    id: 'strength',
    title: 'Strength & Hypertrophy',
    short: 'Strength',
    icon: Dumbbell,
    tag: 'Muscle & Raw Power',
    intensity: 'High Intensity',
    desc: 'Structured compound overload: Squat, Bench, Deadlift, and Press. Engineered for dense muscle growth and functional power.',
    points: [
      'Olympic lifting platforms & calibrated bumper plates',
      'Hypertrophy accessory bays & dumbbells up to 50kg',
      'Real-time form correction by certified strength coaches'
    ],
    protocol: ['Back Squat 4×6', 'Romanian Deadlift 3×8', 'Overhead Press 3×8', 'Bent-Over Row 3×10']
  },
  {
    id: 'hiit',
    title: 'Cardio HIIT & Conditioning',
    short: 'Cardio HIIT',
    icon: Flame,
    tag: 'Fat Loss & Stamina',
    intensity: 'Peak Output',
    desc: 'High-output interval circuits alternating explosive intervals with active recovery. Elevates metabolic burn for hours.',
    points: [
      'Heart-rate guided pacing on Concept2 rowers and air bikes',
      'Dynamic kettlebells, battle ropes & plyometric boxes',
      'Scheduled in morning (5–10 AM) & evening (5–9 PM) batches'
    ],
    protocol: ['Assault Bike 40s/20s', 'Battle Ropes 45s', 'Kettlebell Swings 20 reps', 'Box Jumps 15 reps']
  },
  {
    id: 'functional',
    title: 'Functional Cross-Training',
    short: 'Functional',
    icon: Zap,
    tag: 'Athletic Agility',
    intensity: 'Dynamic Power',
    desc: 'Build real-world athletic power, grip endurance, and core agility through multi-planar barbell and gymnastics movements.',
    points: [
      'Sprint turf with pushing sleds and farmer-carry bars',
      'Multi-grip pull-up rigs & gymnastics rings',
      'Prepares athletes for competitive functional events'
    ],
    protocol: ['Sled Push 4×25m', 'Ring Dips 3×10', 'Wall Balls 4×15', 'Farmer Carry 3×40m']
  },
  {
    id: 'pt',
    title: '1-on-1 Personal Coaching',
    short: '1-on-1 Coaching',
    icon: Users,
    tag: 'Dedicated Mentorship',
    intensity: 'Custom Tailored',
    desc: 'Accelerated personal transformation with a dedicated coach. Customized weekly splits, form assessment, and strict accountability.',
    points: [
      'Customized workout and nutrition protocols updated weekly',
      'Bi-weekly body composition and strength audits',
      'Private 1-on-1 coaching slots at your preferred timing'
    ],
    protocol: ['Movement Assessment', 'Target Compound Work', 'Metabolic Pacing', 'Guided Recovery']
  },
  {
    id: 'mobility',
    title: 'Mobility & Recovery Flow',
    short: 'Mobility',
    icon: HeartPulse,
    tag: 'Joint Longevity',
    intensity: 'Restorative',
    desc: 'Restore tight joints, decompress your spine, and accelerate recovery with flows designed to counteract heavy lifting stiffness.',
    points: [
      'Deep hip openers, thoracic rotations & hamstring length',
      'Breathing techniques that reduce stress and speed repair',
      'Guided Saturday and Sunday morning recovery sessions'
    ],
    protocol: ['Thoracic Foam Roll 10m', '90/90 Hip Openers 10m', 'Dynamic Vinyasa 15m', 'Core Stability 10m']
  }
];

export default function Programs() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('strength');
  const current = programs.find((p) => p.id === activeId) || programs[0];

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-page-wrap">
          <div className="luxury-ambient-glow" />

          {/* Minimal Hero */}
          <div className="luxury-hero">
            <span className="luxury-badge">Disciplines</span>
            <h1 className="luxury-title">
              The <span>Programs</span>.
            </h1>
            <p className="luxury-lead">
              Progressive overload. Proper biomechanics. Coached athletic transformation.
            </p>
          </div>

          {/* Minimalist Segmented Track */}
          <div className="luxury-segmented-track">
            {programs.map((p) => (
              <button
                key={p.id}
                className={`luxury-segment-btn ${activeId === p.id ? 'active' : ''}`}
                onClick={() => setActiveId(p.id)}
              >
                {p.short}
              </button>
            ))}
          </div>

          {/* Spotlight Luxury Glass Card */}
          <div className="luxury-spotlight-card">
            <div style={{ maxWidth: '520px' }}>
              <span className="luxury-card-tag">{current.tag} • {current.intensity}</span>
              <h2 className="luxury-card-title" style={{ fontSize: '32px', marginBottom: '12px' }}>
                {current.title}
              </h2>
              <p className="luxury-card-desc" style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
                {current.desc}
              </p>

              <button className="luxury-btn-primary" onClick={() => navigate('/register')}>
                Join This Discipline <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '28px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--lime)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Core Protocol
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {current.points.map((pt, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d1d1d6' }}>
                      <Check size={14} color="var(--lime)" style={{ flexShrink: 0 }} />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Sample Session Split
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {current.protocol.map((step, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#f5f5f7',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Minimalist Note Bar */}
          <div className="luxury-note-bar">
            Coached floor supervision included in every session • <strong>Morning 5–10 AM</strong> & <strong>Evening 5–9 PM</strong>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
