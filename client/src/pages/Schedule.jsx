import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  CalendarCheck, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Coffee, 
  Sparkles,
  Info,
  Dumbbell,
  Flame
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const vinoScheduleSlots = [
  {
    id: 'morning-early',
    classType: 'morning',
    classLabel: 'Morning Class',
    name: 'Morning Early',
    startTime: '05:00 AM',
    endTime: '07:00 AM',
    duration: '2 Hours',
    capacity: 30,
    crowdLevel: 'Low',
    activity: 'Early Risers Strength & Cardio',
    desc: 'Quiet floor, zero equipment waiting, ideal for focused barbell work and cardio before work.',
    highlights: ['Zero wait time for Olympic platforms', 'Optimal for heavy compound lifting', 'Coached cardio & treadmill warmups']
  },
  {
    id: 'morning-prime',
    classType: 'morning',
    classLabel: 'Morning Class',
    name: 'Morning Prime',
    startTime: '07:00 AM',
    endTime: '10:00 AM',
    duration: '3 Hours',
    capacity: 50,
    crowdLevel: 'Medium',
    activity: 'Hypertrophy & Coach Guidance',
    desc: 'High energy morning crowd with certified trainers available on the gym floor for spotting and form correction.',
    highlights: ['Trainer spotting & form guidance', 'Full cardio suite & strength bays active', 'Peak morning motivational atmosphere']
  },
  {
    id: 'evening-prime',
    classType: 'evening',
    classLabel: 'Evening Class',
    name: 'Evening Prime',
    startTime: '05:00 PM',
    endTime: '07:00 PM',
    duration: '2 Hours',
    capacity: 50,
    crowdLevel: 'High',
    activity: 'HIIT Blast & Prime Strength',
    desc: 'Peak gym energy, group encouragement, and high-intensity workout atmosphere across all bays.',
    highlights: ['High-tempo training music & energy', 'Cardio endurance & fat-loss pacing', 'Dedicated spotters for heavy lifts']
  },
  {
    id: 'evening-power',
    classType: 'evening',
    classLabel: 'Evening Class',
    name: 'Evening Power',
    startTime: '07:00 PM',
    endTime: '09:00 PM',
    duration: '2 Hours',
    capacity: 40,
    crowdLevel: 'Medium',
    activity: 'Night Power & Hypertrophy',
    desc: 'Great evening rhythm for winding down post-work stress with solid lifting before the 9:00 PM close.',
    highlights: ['Steady hypertrophy sets & supersets', 'Cardio cooldowns & assisted stretching', 'Full access until closing at 9:00 PM']
  }
];

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [filterClass, setFilterClass] = useState('all'); // 'all' | 'morning' | 'evening'
  const [selectedSlot, setSelectedSlot] = useState(vinoScheduleSlots[0]);
  const navigate = useNavigate();

  const isSunday = selectedDay === 'Sunday';

  const visibleSlots = vinoScheduleSlots.filter((slot) => {
    if (filterClass === 'all') return true;
    return slot.classType === filterClass;
  });

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        {/* Page Hero */}
        <div className="page-hero" style={{ textAlign: 'center', marginBottom: '28px' }}>
          <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="var(--lime)" /> VINO FITNESS STUDIO • OFFICIAL TIMINGS
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.02em', margin: '8px 0 14px' }}>
            STUDIO TIMINGS & <em style={{ color: 'var(--lime)', fontStyle: 'normal' }}>DAILY SCHEDULE</em>
          </h1>
          <p className="lead-text" style={{ maxWidth: '720px', margin: '0 auto', fontSize: '15px', color: '#9ba58f', lineHeight: 1.6 }}>
            Vino Fitness Studio operates in two dedicated daily shifts to ensure optimal coach availability and spacious platform access.
          </p>
        </div>

        {/* Master Timings Banner from Brochure */}
        <div 
          style={{
            maxWidth: '1050px',
            margin: '0 auto 34px',
            background: 'linear-gradient(135deg, #131c0e 0%, #080c06 100%)',
            border: '1px solid #23331b',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
            {/* Morning Class */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(198,255,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
                <Sun size={24} />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  SHIFT 1 • MORNING CLASS
                </span>
                <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '2px 0 4px', fontWeight: 800 }}>
                  5:00 AM – 10:00 AM
                </h3>
                <p style={{ fontSize: '12px', color: '#9ba58f', margin: 0 }}>
                  5 Hours of coached strength, hypertrophy, and morning cardio conditioning.
                </p>
              </div>
            </div>

            {/* Midday Maintenance Break */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '12px', border: '1px solid #1c2715' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#858d7e', flexShrink: 0 }}>
                <Coffee size={20} />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#858d7e', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  STUDIO BREAK
                </span>
                <div style={{ fontSize: '14px', color: '#cbd5c0', margin: '2px 0', fontWeight: 700 }}>
                  10:00 AM – 5:00 PM
                </div>
                <small style={{ fontSize: '11px', color: '#717a6a' }}>
                  Closed for deep sanitization & trainer rest.
                </small>
              </div>
            </div>

            {/* Evening Class */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(250,204,21,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', flexShrink: 0 }}>
                <Moon size={24} />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#facc15', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  SHIFT 2 • EVENING CLASS
                </span>
                <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '2px 0 4px', fontWeight: 800 }}>
                  5:00 PM – 9:00 PM
                </h3>
                <p style={{ fontSize: '12px', color: '#9ba58f', margin: 0 }}>
                  4 Hours of high-energy strength, HIIT blast, and post-work workout batches.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Day Selector Pills */}
        <div className="interactive-tab-bar" style={{ maxWidth: '850px', margin: '0 auto 20px' }}>
          {daysOfWeek.map((day) => (
            <button
              key={day}
              className={'tab-pill-btn ' + (selectedDay === day ? 'active' : '')}
              onClick={() => setSelectedDay(day)}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Sunday Special Timings Notice */}
        {isSunday && (
          <div 
            style={{
              maxWidth: '850px',
              margin: '0 auto 24px',
              background: 'rgba(250,204,21,0.08)',
              border: '1px solid rgba(250,204,21,0.3)',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#facc15'
            }}
          >
            <Info size={18} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px' }}>
              <strong>Sunday Open Timings:</strong> Morning session operates from <strong>6:00 AM – 10:00 AM</strong>. Evening class remains closed on Sundays for weekly deep maintenance.
            </div>
          </div>
        )}

        {/* Shift Filter Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '26px' }}>
          <button
            onClick={() => setFilterClass('all')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: filterClass === 'all' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: filterClass === 'all' ? 'var(--lime)' : '#0d130a',
              color: filterClass === 'all' ? '#090e06' : '#c9d1c2',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={14} /> All Batches (4 Slots)
          </button>
          <button
            onClick={() => setFilterClass('morning')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: filterClass === 'morning' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: filterClass === 'morning' ? 'var(--lime)' : '#0d130a',
              color: filterClass === 'morning' ? '#090e06' : '#c9d1c2',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sun size={14} /> Morning Class (5 AM – 10 AM)
          </button>
          <button
            onClick={() => setFilterClass('evening')}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: filterClass === 'evening' ? '1px solid var(--lime)' : '1px solid #23331b',
              background: filterClass === 'evening' ? 'var(--lime)' : '#0d130a',
              color: filterClass === 'evening' ? '#090e06' : '#c9d1c2',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Moon size={14} /> Evening Class (5 PM – 9 PM)
          </button>
        </div>

        {/* Schedule Grid */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '20px', 
            maxWidth: '1050px', 
            margin: '0 auto 40px' 
          }}
        >
          {visibleSlots.map((slot) => {
            const isSelected = selectedSlot.id === slot.id;
            const isMorning = slot.classType === 'morning';
            return (
              <div
                key={slot.id}
                className={'interactive-card ' + (isSelected ? 'popular' : '')}
                onClick={() => setSelectedSlot(slot)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: isSelected ? 'var(--lime)' : '#202a16',
                  background: isSelected ? 'linear-gradient(145deg, #131c0e, #090e06)' : '#080c06',
                  padding: '24px 20px',
                  borderRadius: '16px',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'translateY(-4px)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '10px', 
                    background: isMorning ? 'rgba(198,255,0,0.1)' : 'rgba(250,204,21,0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: isMorning ? 'var(--lime)' : '#facc15' 
                  }}>
                    {isMorning ? <Sun size={18} /> : <Moon size={18} />}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '10px',
                      background: slot.crowdLevel === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(198,255,0,0.12)',
                      color: slot.crowdLevel === 'High' ? '#f87171' : 'var(--lime)',
                      border: `1px solid ${slot.crowdLevel === 'High' ? '#5a1d1d' : '#23331b'}`
                    }}
                  >
                    {slot.crowdLevel} Density
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: isMorning ? 'var(--lime)' : '#facc15', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {slot.classLabel}
                </div>
                <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '4px 0 6px', fontWeight: 800 }}>
                  {slot.name}
                </h3>
                
                <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}>
                  {slot.startTime} – {slot.endTime}
                  <span style={{ fontSize: '11px', color: '#858d7e', fontWeight: 500, marginLeft: '6px' }}>({slot.duration})</span>
                </div>

                <p style={{ fontSize: '12px', color: '#9ba58f', margin: '0 0 16px', lineHeight: 1.5, flexGrow: 1 }}>
                  {slot.activity}
                </p>

                <div style={{ borderTop: '1px solid #1b2614', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#747d6d' }}>
                  <span>Max Capacity:</span>
                  <strong style={{ color: '#ffffff' }}>{slot.capacity} Athletes</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Slot Interactive Preview Card */}
        <div 
          className="interactive-card" 
          style={{ 
            maxWidth: '900px', 
            margin: '0 auto 40px', 
            padding: '30px 28px',
            background: 'linear-gradient(135deg, #131c0e, #090e06)',
            border: '1px solid #283a1d',
            borderRadius: '16px'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              RESERVED BATCH PREVIEW
            </span>
            <h3 style={{ fontSize: '24px', color: '#ffffff', margin: '6px 0 8px', fontWeight: 800 }}>
              {selectedDay} • {selectedSlot.name} ({selectedSlot.startTime} – {selectedSlot.endTime})
            </h3>
            <p style={{ fontSize: '14px', color: '#cbd5c0', maxWidth: '620px', margin: '0 auto', lineHeight: '1.6' }}>
              {selectedSlot.desc}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', margin: '0 auto 24px', maxWidth: '750px' }}>
            {selectedSlot.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#e2e7dc', background: '#0a0e08', padding: '10px 14px', borderRadius: '10px', border: '1px solid #1f2c18' }}>
                <CheckCircle2 size={15} color="var(--lime)" style={{ flexShrink: 0 }} />
                <span>{h}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="lime-btn" style={{ height: '44px', padding: '0 28px', fontSize: '13px', fontWeight: 700 }} onClick={() => navigate('/register')}>
              Reserve This Slot & Register <ArrowRight size={15} />
            </button>
            <button className="ghost-btn" style={{ height: '44px', padding: '0 24px', fontSize: '13px' }} onClick={() => navigate('/memberships')}>
              View Membership Plans
            </button>
          </div>

          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #1c2615', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', fontSize: '11px', color: '#858d7e' }}>
            <span><CheckCircle2 size={13} color="var(--lime)" style={{ display: 'inline', marginRight: '4px' }} /> Biometric Touch Kiosk Entry</span>
            <span><ShieldCheck size={13} color="var(--lime)" style={{ display: 'inline', marginRight: '4px' }} /> Guaranteed platform availability</span>
            <span><Clock size={13} color="var(--lime)" style={{ display: 'inline', marginRight: '4px' }} /> Easy slot change in Member Dashboard</span>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
