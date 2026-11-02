import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Award, Dumbbell, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const trainersList = [
  {
    id: 'TR001',
    name: 'Kabir Singh',
    role: 'Head Strength & Conditioning Coach',
    specialization: 'Strength & Conditioning, Powerlifting',
    experience: '8+ Years Experience',
    certifications: ['NASM-CPT', 'ACE Certified', 'Olympic Lifting L1'],
    bio: 'Specializes in building bulletproof compound lifts (Squat, Bench, Deadlift), correcting biomechanical dysfunctions, and heavy strength progression.',
    clientsTrained: '450+ Athletes',
    rating: '4.9/5'
  },
  {
    id: 'TR002',
    name: 'Naina Kapoor',
    role: 'Body Transformation & Conditioning Coach',
    specialization: 'HIIT Conditioning & Nutrition Strategy',
    experience: '6+ Years Experience',
    certifications: ['ACE-CPT', 'Precision Nutrition L1', 'TRX Specialist'],
    bio: 'Known for high-energy conditioning and sustainable dietary protocols. Helps busy professionals shed stubborn fat and sculpt lean muscle.',
    clientsTrained: '380+ Athletes',
    rating: '5.0/5'
  },
  {
    id: 'TR003',
    name: 'Arjun Das',
    role: 'Functional Agility & Mobility Specialist',
    specialization: 'Cross-Training & Athletic Performance',
    experience: '7+ Years Experience',
    certifications: ['Crossfit L2', 'CSCS', 'Kettlebell Master'],
    bio: 'Trains athletes for explosive power, core stability, and joint longevity using Olympic lifting, sled work, and gymnastics patterns.',
    clientsTrained: '310+ Athletes',
    rating: '4.9/5'
  }
];

export default function Trainers() {
  const [selectedTrainer, setSelectedTrainer] = useState(trainersList[0]);
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><Users size={14} /> CERTIFIED COACHING TEAM</p>
          <h1>TRAIN UNDER <em>CERTIFIED EXPERTS</em></h1>
          <p className="lead-text">
            Our certified coaches are on the gym floor daily to ensure safe form, spot your heavy lifts, and hold you accountable to your fitness targets.
          </p>
        </div>

        {/* Minimal Trainer Cards */}
        <div className="minimal-grid-3" style={{ maxWidth: '980px', margin: '0 auto 40px' }}>
          {trainersList.map((t) => {
            const isSelected = selectedTrainer.id === t.id;
            return (
              <div
                key={t.id}
                className={'minimal-card ' + (isSelected ? 'selected' : '')}
                onClick={() => setSelectedTrainer(t)}
              >
                <div className="minimal-card-top">
                  <div className="minimal-card-icon"><Users size={18} /></div>
                  <span className="minimal-card-badge" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Star size={11} fill="var(--lime)" color="var(--lime)" /> {t.rating}
                  </span>
                </div>
                <h4>{t.name}</h4>
                <div style={{ fontSize: '11px', color: 'var(--lime)', fontWeight: 600, marginBottom: '6px' }}>
                  {t.role}
                </div>
                <p style={{ fontSize: '12px', color: '#9ba58f', lineHeight: '1.5', marginBottom: '12px' }}>
                  {t.specialization}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid #1c2514', paddingTop: '8px' }}>
                  {t.certifications.map((c, i) => (
                    <span key={i} style={{ fontSize: '9px', background: '#12170d', color: '#c2c7be', padding: '2px 6px', borderRadius: '4px' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Trainer Spotlight */}
        <div className="interactive-card" style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px', alignItems: 'center' }}>
            <div>
              <span className="minimal-card-badge" style={{ display: 'inline-block', marginBottom: '8px' }}>
                {selectedTrainer.experience}
              </span>
              <h3 style={{ fontSize: '24px', color: '#ffffff', margin: '0 0 6px' }}>{selectedTrainer.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--lime)', fontWeight: 500, margin: '0 0 14px' }}>
                {selectedTrainer.specialization}
              </p>
              <p style={{ fontSize: '13px', color: '#a5ada0', lineHeight: '1.6', margin: '0 0 20px' }}>
                {selectedTrainer.bio}
              </p>

              <button className="lime-btn" onClick={() => navigate('/register')}>
                Train With {selectedTrainer.name.split(' ')[0]} <ArrowRight size={15} />
              </button>
            </div>

            <div style={{
              background: '#070906',
              border: '1px solid #1f2716',
              borderRadius: '12px',
              padding: '22px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, letterSpacing: '0.1em' }}>
                CLIENT TRANSFORMATION RECORD
              </span>
              <strong style={{ display: 'block', fontSize: '32px', color: '#ffffff', margin: '10px 0 4px', fontWeight: 800 }}>
                {selectedTrainer.clientsTrained}
              </strong>
              <small style={{ fontSize: '11px', color: '#858d7e' }}>Active & Transformed Members</small>

              <div style={{ borderTop: '1px solid #182012', marginTop: '16px', paddingTop: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#9ba58f' }}>
                  <CheckCircle2 size={13} color="var(--lime)" /> Bi-weekly 1-on-1 progress reviews
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#9ba58f', marginTop: '6px' }}>
                  <CheckCircle2 size={13} color="var(--lime)" /> Custom macro & nutrition guidance
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

