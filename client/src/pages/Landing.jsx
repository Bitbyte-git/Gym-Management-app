import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Globe2, Dumbbell, Smile, CalendarCheck, Trophy,
  Users, Flame, Building2, UserRoundPlus, Settings2, TrendingUp,
  Quote, Check, Sparkles, Clock, ShieldCheck, Headphones, Zap
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const memberGoals = [
  {
    id: 'muscle',
    name: 'Build Muscle',
    icon: Dumbbell,
    program: 'Strength & Hypertrophy',
    slot: 'Evening Early (05:00 PM – 07:00 PM)',
    trainer: 'Kabir Singh (Head Strength Coach)',
    summary: 'Focus on progressive overload with heavy barbells, calibrated Olympic plates, and high-volume accessory sets.'
  },
  {
    id: 'shred',
    name: 'Fat Loss & Shred',
    icon: Flame,
    program: 'HIIT Blast & Conditioning',
    slot: 'Morning Early (05:00 AM – 07:00 AM)',
    trainer: 'Naina Kapoor (Conditioning Specialist)',
    summary: 'High-intensity interval circuits, assault bikes, kettlebells, and metabolic pacing for rapid fat burning.'
  },
  {
    id: 'athletic',
    name: 'Athletic Power',
    icon: Zap,
    program: 'Functional Cross-Training',
    slot: 'Morning Regular (07:00 AM – 10:00 AM)',
    trainer: 'Arjun Das (Functional Specialist)',
    summary: 'Dynamic multi-planar training, sled drives, gymnastics rings, and Olympic lifts for explosive stamina.'
  },
  {
    id: 'coaching',
    name: '1-on-1 Coaching',
    icon: Users,
    program: 'Personal Trainer Transformation',
    slot: 'Flexible Custom Slot (Mon – Sat)',
    trainer: 'Assigned Certified Coach',
    summary: 'Tailored weekly workout programming, custom nutritional macro breakdown, and bi-weekly body fat checks.'
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const [live, setLive] = useState({ checkins: 0, revenue: 0, members: 0 });
  const [activeClass, setActiveClass] = useState(0);
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedGoal, setSelectedGoal] = useState(memberGoals[0]);

  const cardProps = (id) => ({
    role: 'button',
    tabIndex: 0,
    'aria-pressed': selectedCard === id,
    onClick: () => setSelectedCard((v) => (v === id ? '' : id)),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSelectedCard((v) => (v === id ? '' : id));
      }
    }
  });

  // Live Counter Animation in Hero
  useEffect(() => {
    const started = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - started) / 1300, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setLive({
        checkins: Math.round(186 * eased),
        revenue: Math.round(248620 * eased),
        members: Math.round(2458 * eased)
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const pulse = setInterval(
      () => setLive((v) => ({ ...v, checkins: v.checkins + 1, members: v.members + (Math.random() > 0.65 ? 1 : 0) })),
      6500
    );
    const classes = setInterval(() => setActiveClass((v) => (v + 1) % 3), 2800);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(pulse);
      clearInterval(classes);
    };
  }, []);

  return (
    <PublicLayout>
      {/* -------------------- HERO SECTION -------------------- */}
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">PREMIUM UNISEX FITNESS STUDIO</p>
          <h1>
            BUILT FOR POWER.<br />
            <em>DESIGNED FOR GROWTH.</em>
          </h1>
          <p className="lead">
            VINO FITNESS STUDIO empowers athletes and fitness enthusiasts with elite training equipment, certified coaches, 0.3s biometric check-in, and transparent memberships.
          </p>
          <div className="hero-actions">
            <button className="lime-btn" onClick={() => navigate('/register')}>
              Join Studio Today <ArrowRight />
            </button>
            <button className="ghost-btn" onClick={() => navigate('/programs')}>
              Explore Programs <ArrowRight />
            </button>
          </div>

        </div>

        <div className="hero-visual">
          <img className="hero-man" src="/hero-man.png" alt="Vino Fitness Studio Trainer" />

          <div className={'float-card checkins ' + (selectedCard === 'checkins' ? 'is-active' : '')} {...cardProps('checkins')}>
            <span className="live-dot" />
            <small>Today's Check-ins</small>
            <strong>
              {live.checkins.toLocaleString('en-IN')} <b>↑ 12.4%</b>
            </strong>
            <span>vs yesterday</span>
            <svg className="line-chart" viewBox="0 0 140 38">
              <polyline points="2,31 13,27 23,30 34,19 45,22 56,13 68,17 79,8 91,15 103,11 115,20 128,8 138,3" />
              <circle cx="138" cy="3" r="2.5" />
            </svg>
          </div>

          <div className={'float-card revenue-card ' + (selectedCard === 'revenue' ? 'is-active' : '')} {...cardProps('revenue')}>
            <span className="live-dot" />
            <small>Active Roster</small>
            <strong>
              {live.members.toLocaleString('en-IN')} <b>Athletes</b>
            </strong>
            <span>training this month</span>
            <div className="mini-bars">
              {[30, 54, 38, 67, 45, 72, 51, 81, 58, 88].map((h, i) => (
                <i key={i} style={{ '--bar-height': h + '%', '--bar-delay': i * 70 + 'ms' }} />
              ))}
            </div>
          </div>

          <div className={'float-card members-card ' + (selectedCard === 'members' ? 'is-active' : '')} {...cardProps('members')}>
            <span className="live-dot" />
            <small>TOTAL MEMBERS</small>
            <strong>
              {live.members.toLocaleString('en-IN')} <b>↑ 18.6%</b>
            </strong>
            <span>community growing</span>
            <div className="avatars">
              <i>AM</i>
              <i>IR</i>
              <i>DK</i>
              <i>+</i>
            </div>
          </div>

          <div className={'float-card class-card ' + (selectedCard === 'classes' ? 'is-active' : '')} {...cardProps('classes')}>
            <small>Today's Sessions</small>
            <div className={'class-row ' + (activeClass === 0 ? 'active' : '')}>
              <Dumbbell />
              <span>
                <b>Morning Early</b>
                <small>05:00 AM – 07:00 AM</small>
              </span>
            </div>
            <div className={'class-row ' + (activeClass === 1 ? 'active' : '')}>
              <Users />
              <span>
                <b>Morning Prime</b>
                <small>07:00 AM – 10:00 AM</small>
              </span>
            </div>
            <div className={'class-row ' + (activeClass === 2 ? 'active' : '')}>
              <Flame />
              <span>
                <b>Evening Prime</b>
                <small>05:00 PM – 07:00 PM</small>
              </span>
            </div>
            <div className={'class-row ' + (activeClass === 3 ? 'active' : '')}>
              <Flame />
              <span>
                <b>Evening Power</b>
                <small>07:00 PM – 09:00 PM</small>
              </span>
            </div>
            <Link to="/schedule" className="schedule-link">
              View Full Schedule <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------- INTERACTIVE MEMBER GOAL SELECTOR -------------------- */}
      <section className="wrap" style={{ marginTop: '20px', marginBottom: '50px' }}>
        <div className="landing-interactive-previewer">
          <div className="previewer-head">
            <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, letterSpacing: '0.1em' }}>
              FIND YOUR PERFECT WORKOUT
            </span>
            <h3>What Is Your Primary Fitness Goal?</h3>
            <p>Select your objective to preview your recommended training discipline and optimal studio time slot.</p>
          </div>

          {/* Goal Selector Buttons */}
          <div className="interactive-tab-bar">
            {memberGoals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <button
                  key={goal.id}
                  className={'tab-pill-btn ' + (selectedGoal.id === goal.id ? 'active' : '')}
                  onClick={() => setSelectedGoal(goal)}
                >
                  <GoalIcon />
                  {goal.name}
                </button>
              );
            })}
          </div>

          <div className="previewer-stage">
            <div className="previewer-actions-col">
              <h4>Recommended: {selectedGoal.program}</h4>
              <p>{selectedGoal.summary}</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="previewer-interactive-trigger" onClick={() => navigate('/register')}>
                  <Sparkles size={14} /> Join This Program
                </button>
                <Link
                  to="/programs"
                  style={{ fontSize: '12px', color: 'var(--lime)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Learn More <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="previewer-live-screen">
              <div className="live-screen-top">
                <span>IDEAL SESSION MATCH</span>
                <span style={{ color: 'var(--lime)' }}>VERIFIED SLOT</span>
              </div>
              <div className="live-screen-output">
                <strong style={{ color: '#ffffff' }}>{selectedGoal.slot}</strong>
                <small>Lead Coach: {selectedGoal.trainer}</small>
                <small style={{ marginTop: '6px', color: 'var(--lime)' }}>✓ Zero floor overcrowding guarantee</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- PROOF SECTION -------------------- */}
      <section className="proof">
        <div className="wrap proof-grid">
          {[
            [Dumbbell, '5000+', 'Athletes Trust Vino Fitness'],
            [Smile, '2.5L+', 'Workouts Completed'],
            [CalendarCheck, '10L+', 'Check-ins Recorded'],
            [Trophy, '98%', 'Member Satisfaction']
          ].map(([Icon, n, l]) => (
            <div key={n}>
              <Icon />
              <strong>{n}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------- HOW TO JOIN / 4 STEPS -------------------- */}
      <section className="section wrap how-section" id="how-it-works">
        <div className="section-head">
          <p className="eyebrow">SIMPLE 4-STEP JOURNEY</p>
          <h2>HOW TO JOIN VINO FITNESS STUDIO</h2>
        </div>
        <div className="steps">
          {[
            [Building2, '01', 'Choose Your Plan'],
            [UserRoundPlus, '02', 'Pick Your Slot'],
            [Settings2, '03', 'Secure UPI Pay'],
            [TrendingUp, '04', 'Start Training']
          ].map(([Icon, n, t], i) => (
            <article key={n}>
              <b>{n}</b>
              <Icon />
              <h3>{t}</h3>
              <p>
                {[
                  'Select Basic, Standard, Premium, or Annual membership.',
                  'Choose your preferred morning or evening workout slot.',
                  'Complete instant online registration via Razorpay UPI.',
                  'Check in with your biometric / QR pass and start lifting!'
                ][i]}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------- POPULAR MEMBERSHIPS GLIMPSE -------------------- */}
      <section className="section price-section" id="pricing">
        <div className="wrap">
          <div className="section-head left price-intro">
            <p className="eyebrow">OFFICIAL RATE CARD</p>
            <h2>
              Vino Fitness Studio<br />
              Membership Plans.
            </h2>
            <span className="scribble">↝</span>
          </div>

          <div>
            {/* Timing strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', background: '#0e150a', border: '1px solid #23331b', borderRadius: '12px', padding: '12px 18px', marginBottom: '22px' }}>
              <span style={{ fontSize: '13px', color: '#c9d1c2' }}>
                <strong style={{ color: 'var(--lime)' }}>Classes:</strong> Morning 5:00 AM – 10:00 AM • Evening 5:00 PM – 9:00 PM
              </span>
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>
                One-Time Admission Fee: ₹500 (Non-Refundable)
              </span>
            </div>

            <div className="plans">
              <article>
                <p>Weight Training</p>
                <small>Monthly to Yearly Strength Plans</small>
                <h3>₹800<span>/month</span></h3>
                <div style={{ fontSize: '11px', color: 'var(--lime)', marginBottom: '14px', fontWeight: 700 }}>
                  Yearly plan only ₹6,000 (₹500/mo)
                </div>
                <ul>
                  <li><Check size={14} color="var(--lime)" /> Full weight training floor access</li>
                  <li><Check size={14} color="var(--lime)" /> Free weights, dumbbells & cable bays</li>
                  <li><Check size={14} color="var(--lime)" /> Locker room & private shower access</li>
                  <li><Check size={14} color="var(--lime)" /> Biometric fingerprint check-in pass</li>
                </ul>
                <button className="outline-btn" onClick={() => navigate('/memberships')}>
                  View Weight Plans <ArrowRight size={14} />
                </button>
              </article>

              <article className="popular">
                <span className="tag">MOST POPULAR COMBO</span>
                <p>Cardio & Weight</p>
                <small>Full Conditioning & Hypertrophy</small>
                <h3>₹1,500<span>/month</span></h3>
                <div style={{ fontSize: '11px', color: 'var(--lime)', marginBottom: '14px', fontWeight: 700 }}>
                  Yearly plan only ₹7,500 (₹625/mo)
                </div>
                <ul>
                  <li><Check size={14} color="var(--lime)" /> Full Cardio equipment + Weight floor</li>
                  <li><Check size={14} color="var(--lime)" /> Treadmills, cross-trainers & spin bikes</li>
                  <li><Check size={14} color="var(--lime)" /> Fat-loss & stamina conditioning</li>
                  <li><Check size={14} color="var(--lime)" /> Locker room & shower access included</li>
                </ul>
                <button className="lime-btn" onClick={() => navigate('/memberships')}>
                  View Cardio & Weight <ArrowRight size={14} />
                </button>
              </article>

              <article>
                <span className="tag" style={{ background: '#303f19', color: 'var(--lime)' }}>1-ON-1 COACHING</span>
                <p>Personal Training</p>
                <small>16 Classes (30 Days Maximum)</small>
                <h3>₹4,000<span>/16 sessions</span></h3>
                <div style={{ fontSize: '11px', color: 'var(--lime)', marginBottom: '14px', fontWeight: 700 }}>
                  Dedicated certified mentor
                </div>
                <ul>
                  <li><Check size={14} color="var(--lime)" /> 16 Individual coaching sessions</li>
                  <li><Check size={14} color="var(--lime)" /> Custom workout split & form correction</li>
                  <li><Check size={14} color="var(--lime)" /> Body fat & progress audits</li>
                  <li><Check size={14} color="var(--lime)" /> Strict accountability & diet advice</li>
                </ul>
                <button className="outline-btn" onClick={() => navigate('/memberships')}>
                  Explore Coaching <ArrowRight size={14} />
                </button>
              </article>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link
                to="/memberships"
                style={{ fontSize: '13px', color: 'var(--lime)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Compare All Membership Tiers & Privileges <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- STORIES -------------------- */}
      <section className="section wrap stories" id="stories">
        <div className="section-head left">
          <p className="eyebrow">ATHLETE TRANSFORMATIONS</p>
          <h2>Real Members.<br />Real Strength.</h2>
          <span className="scribble">〰</span>
        </div>
        <div className="quotes">
          {[
            ['Rakesh Kumar', 'Vino Fitness Member', 'Vino Fitness Studio has transformed my daily routine and helped me reach peak conditioning.'],
            ['Simran Kaur', 'Fitness Enthusiast', 'The coaches and facilities at Vino Fitness Studio are top notch. Best fitness decision I have made.'],
            ['Arjun Mehta', 'Power Lifter', 'From biometric check-in to workout tracking, everything just flows seamlessly. Love training here.']
          ].map(([n, c, q]) => (
            <article key={n}>
              <Quote />
              <p>{q}</p>
              <div>
                <i>{n.split(' ').map((x) => x[0]).join('')}</i>
                <span>
                  <b>{n}</b>
                  <small>{c}</small>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------- CTA BANNER -------------------- */}
      <section className="cta studio-cta-section">
        <div className="wrap">
          <div className="studio-cta-card">
            {/* Background Athlete Artwork & Aura Glow */}
            <div className="studio-cta-glow" aria-hidden="true" />
            <div className="studio-cta-art" aria-hidden="true" />

            <div className="studio-cta-content">
              <div className="studio-cta-badge">
                <Sparkles size={13} />
                <span>UNLEASH YOUR POTENTIAL</span>
              </div>

              <h2>
                Ready to Train at<br />
                <span className="studio-cta-highlight">Vino Fitness Studio?</span>
              </h2>

              <p className="studio-cta-desc">
                Join thousands of athletes who push their limits and build strength with Vino Fitness Studio. Start today with instant registration, elite equipment, and personal coaching.
              </p>

              <div className="studio-cta-notes">
                <div className="studio-cta-note-pill">
                  <div className="note-pill-icon">
                    <CalendarCheck size={18} />
                  </div>
                  <div className="note-pill-info">
                    <strong>Instant Online</strong>
                    <span>Direct Registration</span>
                  </div>
                </div>

                <div className="studio-cta-note-pill">
                  <div className="note-pill-icon">
                    <Headphones size={18} />
                  </div>
                  <div className="note-pill-info">
                    <strong>Certified Coach</strong>
                    <span>Personal Guidance</span>
                  </div>
                </div>

                <div className="studio-cta-note-pill">
                  <div className="note-pill-icon">
                    <Zap size={18} />
                  </div>
                  <div className="note-pill-info">
                    <strong>0.3s Biometric</strong>
                    <span>Express Studio Access</span>
                  </div>
                </div>
              </div>

              <div className="studio-cta-actions">
                <button className="lime-btn studio-cta-btn-main" onClick={() => navigate('/register')}>
                  Start Your Membership <ArrowRight size={16} />
                </button>
                <button className="ghost-btn studio-cta-btn-sub" onClick={() => navigate('/memberships')}>
                  View All Plans & Privileges
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
