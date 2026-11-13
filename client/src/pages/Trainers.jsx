import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ArrowRight, Check } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../luxury-pages.css';

const trainersList = [
  {
    id: 'TR001',
    name: 'Kabir Singh',
    role: 'Head Strength Coach',
    specialty: 'Powerlifting & Biomechanics',
    experience: '8+ Years',
    rating: '4.9',
    certs: 'NASM-CPT • Olympic Lifting L1',
    bio: 'Specializes in heavy compound progressions (Squat, Bench, Deadlift) and structural biomechanical correction.',
    highlights: ['Competition platform coach', '450+ Athletes trained', 'Olympic bar technique expert']
  },
  {
    id: 'TR002',
    name: 'Naina Kapoor',
    role: 'Conditioning Specialist',
    specialty: 'Metabolic HIIT & Body Recomp',
    experience: '6+ Years',
    rating: '5.0',
    certs: 'ACE-CPT • Precision Nutrition L1',
    bio: 'High-energy athletic conditioning protocols combined with sustainable macronutrient periodization.',
    highlights: ['Endurance and fat-loss pacing', '380+ Transformations', 'Nutritional macro auditor']
  },
  {
    id: 'TR003',
    name: 'Arjun Das',
    role: 'Functional Agility Coach',
    specialty: 'Cross-Training & Mobility',
    experience: '7+ Years',
    rating: '4.9',
    certs: 'Crossfit L2 • CSCS Master',
    bio: 'Trains athletes for explosive power, core stability, and joint longevity using Olympic lifts and gymnastic rings.',
    highlights: ['Athletic conditioning specialist', '310+ Athletes mentored', 'Mobility & joint health lead']
  }
];

export default function Trainers() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-page-wrap">
          <div className="luxury-ambient-glow" />

          {/* Minimal Hero */}
          <div className="luxury-hero">
            <span className="luxury-badge">Coaching Staff</span>
            <h1 className="luxury-title">
              The <span>Coaches</span>.
            </h1>
            <p className="luxury-lead">
              Certified mentors on the floor daily. Spotting heavy lifts, perfecting form, and accelerating your progress.
            </p>
          </div>

          {/* Luxury 3-Card Grid */}
          <div className="luxury-grid-3">
            {trainersList.map((t) => (
              <div key={t.id} className="luxury-glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span className="luxury-card-tag">{t.experience}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--lime)', background: 'rgba(198,255,0,0.1)', padding: '3px 10px', borderRadius: '12px' }}>
                    <Star size={11} fill="var(--lime)" color="var(--lime)" /> {t.rating}
                  </span>
                </div>

                <h3 className="luxury-card-title">{t.name}</h3>
                <div style={{ fontSize: '13px', color: 'var(--lime)', fontWeight: 600, marginBottom: '4px' }}>
                  {t.role}
                </div>
                <div style={{ fontSize: '11px', color: '#86868b', marginBottom: '16px' }}>
                  {t.certs}
                </div>

                <p className="luxury-card-desc" style={{ marginBottom: '22px' }}>
                  {t.bio}
                </p>

                <ul className="luxury-card-points">
                  {t.highlights.map((h, idx) => (
                    <li key={idx}>
                      <Check size={13} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <button className="luxury-btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/register')}>
                  Train with {t.name.split(' ')[0]} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Minimalist Note Bar */}
          <div className="luxury-note-bar">
            Coaches available on the gym floor during all active shift hours • <strong>5–10 AM</strong> & <strong>5–9 PM</strong>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
