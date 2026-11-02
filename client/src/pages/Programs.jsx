import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell, Flame, Zap, Users, HeartPulse, ArrowRight, Check,
  Sparkles, CheckCircle2
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const programsData = [
  {
    id: 'strength',
    title: 'Strength & Hypertrophy',
    icon: Dumbbell,
    tag: 'Muscle & Power',
    intensity: 'High Intensity',
    summary: 'Master the core compound lifts: Squat, Bench, Deadlift, and Overhead Press. Structured progressive overload protocols designed to build dense muscle and raw strength.',
    benefits: [
      'Olympic lifting platforms and calibrated competition bumper plates.',
      'Hypertrophy accessory bays with dual cable stations and dumbbells up to 50kg.',
      'Personal record (PR) tracking and form correction by certified trainers.'
    ],
    sampleWorkout: ['Barbell Back Squat (4x6 @ 80%)', 'Romanian Deadlift (3x8)', 'Standing Military Press (3x8)', 'Barbell Bent-Over Row (3x10)']
  },
  {
    id: 'hiit',
    title: 'HIIT Blast & Conditioning',
    icon: Flame,
    tag: 'Fat Loss & Stamina',
    intensity: 'Peak Intensity',
    summary: 'Explosive functional circuits alternating high-output anaerobic intervals with active recovery. Burns up to 800+ calories per session while elevating metabolic rate.',
    benefits: [
      'Heart-rate guided interval coaching on Concept2 rowers and air bikes.',
      'Dynamic kettlebell, battle rope, and plyometric box training.',
      'Morning (06:00 AM) and evening (06:00 PM) daily batches.'
    ],
    sampleWorkout: ['Air Bike Sprint (40s sprint / 20s rest)', 'Battle Rope Slams (45s)', 'Kettlebell Swings (20 reps)', 'Box Jump Burpees (15 reps)']
  },
  {
    id: 'functional',
    title: 'Functional Cross-Training',
    icon: Zap,
    tag: 'Athletic Agility',
    intensity: 'High Intensity',
    summary: 'Build real-world functional power, core stability, and agility with dynamic multi-planar barbell, gymnastics, and endurance movements.',
    benefits: [
      'Full-turf sprint track with pushing sleds and farmers-walk bars.',
      'Multi-grip pull-up rigs, gymnastics rings, and wall-ball stations.',
      'Prepares athletes for competitive fitness and obstacle challenges.'
    ],
    sampleWorkout: ['Sled Push (4x25m heavy load)', 'Ring Dips (3x10)', 'Medicine Ball Slams (4x15)', 'Farmer Carries (3x40m)']
  },
  {
    id: 'pt',
    title: '1-on-1 Personal Coaching',
    icon: Users,
    tag: 'Maximum Accountability',
    intensity: 'Custom Tailored',
    summary: 'Accelerate your transformation with a dedicated certified coach. Every workout, nutritional intake, and technique check is tailored to your body type and fitness goals.',
    benefits: [
      'Customized workout and macro/diet plans updated weekly.',
      'Bi-weekly body fat percentage, circumference, and strength audits.',
      'Private 1-on-1 session slots scheduled at your preferred timing.'
    ],
    sampleWorkout: ['Personalized warm-up & activation', 'Target compound progression', 'Targeted metabolic conditioning', 'Assisted mobility & post-workout stretch']
  },
  {
    id: 'mobility',
    title: 'Mobility & Yoga Flow',
    icon: HeartPulse,
    tag: 'Recovery & Flexibility',
    intensity: 'Moderate Flow',
    summary: 'Restore tight joints, strengthen your core, and accelerate muscular recovery with mobility flows designed to counteract desk posture and heavy lifting stiffness.',
    benefits: [
      'Deep hip openers, thoracic spine rotations, and hamstring lengthening.',
      'Breathing techniques that reduce cortisol and speed up muscular repair.',
      'Guided Saturday and Sunday morning recovery sessions.'
    ],
    sampleWorkout: ['Dynamic Vinyasa Flow (15 min)', 'Pigeon & 90/90 Hip Openers (10 min)', 'Thoracic Foam Rolling (10 min)', 'Core Stability Planks (10 min)']
  }
];

export default function Programs() {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();
  const current = programsData[activeTab];

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><Dumbbell size={14} /> TRAINING DISCIPLINES</p>
          <h1>PROGRAMS BUILT FOR <em>REAL TRANSFORMATION</em></h1>
          <p className="lead-text">
            No generic routines. Every program at Vino Fitness Studio is structured around progressive overload, proper biomechanics, and sustainable nutrition.
          </p>
        </div>

        {/* Interactive Discipline Selector */}
        <div className="interactive-tab-bar">
          {programsData.map((prog, idx) => {
            const Icon = prog.icon;
            return (
              <button
                key={prog.id}
                className={'tab-pill-btn ' + (activeTab === idx ? 'active' : '')}
                onClick={() => setActiveTab(idx)}
              >
                <Icon />
                {prog.title.split('&')[0]}
              </button>
            );
          })}
        </div>

        {/* Interactive Program Detail Card */}
        <div className="interactive-card" style={{ maxWidth: '920px', margin: '0 auto 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <span className="minimal-card-badge">{current.tag}</span>
                <span className="minimal-card-badge" style={{ background: '#1c2414', borderColor: '#3a4b22' }}>
                  {current.intensity}
                </span>
              </div>
              <h3 style={{ fontSize: '24px', color: '#ffffff', margin: '0 0 10px' }}>{current.title}</h3>
              <p style={{ fontSize: '13px', color: '#a5ada0', lineHeight: '1.6', margin: '0 0 20px' }}>
                {current.summary}
              </p>

              <h4 style={{ fontSize: '13px', color: 'var(--lime)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Program Highlights
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '10px' }}>
                {current.benefits.map((b, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#e2e7dc' }}>
                    <Check size={16} color="var(--lime)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <button className="lime-btn" onClick={() => navigate('/register')}>
                Join This Program <ArrowRight size={15} />
              </button>
            </div>

            {/* Sample Routine Preview Card */}
            <div style={{
              background: '#070906',
              border: '1px solid #1f2716',
              borderRadius: '12px',
              padding: '22px'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                SAMPLE SESSION PROTOCOL
              </span>
              <h4 style={{ fontSize: '16px', color: '#ffffff', margin: '8px 0 14px' }}>Daily Workout Structure</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {current.sampleWorkout.map((ex, i) => (
                  <div key={i} style={{
                    background: '#0b0f0a',
                    border: '1px solid #1c2414',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#d5dad0',
                    fontFamily: 'monospace'
                  }}>
                    {i + 1}. {ex}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #171f11', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#858d7e' }}>
                <CheckCircle2 size={15} color="var(--lime)" /> Certified coach supervision on gym floor
              </div>
            </div>
          </div>
        </div>

        {/* Action strip */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <p style={{ fontSize: '13px', color: '#9ba58f', marginBottom: '14px' }}>
            Want a personalized fitness roadmap? Speak to our head trainer at the studio.
          </p>
          <div style={{ display: 'inline-flex', gap: '12px' }}>
            <button className="ghost-btn" onClick={() => navigate('/contact')}>
              Book 1-Day Trial Pass
            </button>
            <button className="lime-btn" onClick={() => navigate('/register')}>
              Register as Member <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

