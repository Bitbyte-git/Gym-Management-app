import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarCheck, Users, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const standardSlots = [
  {
    name: 'Morning Early',
    startTime: '05:00 AM',
    endTime: '07:00 AM',
    capacity: 30,
    crowdLevel: 'Low',
    activity: 'Early Risers Strength & Cardio',
    desc: 'Quiet floor, zero equipment waiting, ideal for focused barbell work before work.'
  },
  {
    name: 'Morning Regular',
    startTime: '07:00 AM',
    endTime: '10:00 AM',
    capacity: 50,
    crowdLevel: 'Medium',
    activity: 'Hypertrophy & Coach Guidance',
    desc: 'High energy morning crowd with coaches available on the gym floor for spotters.'
  },
  {
    name: 'Mid-Morning',
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    capacity: 40,
    crowdLevel: 'Very Low',
    activity: 'Open Floor & Mobility',
    desc: 'Unhurried training tempo, ideal for extended recovery flows and functional work.'
  },
  {
    name: 'Afternoon',
    startTime: '02:00 PM',
    endTime: '05:00 PM',
    capacity: 40,
    crowdLevel: 'Low',
    activity: 'Powerlifting & Technical Form',
    desc: 'Uncrowded bays for testing 1RM personal records and specialized conditioning.'
  },
  {
    name: 'Evening Early',
    startTime: '05:00 PM',
    endTime: '07:00 PM',
    capacity: 50,
    crowdLevel: 'High',
    activity: 'HIIT Blast & Prime Strength',
    desc: 'Peak gym energy, group encouragement, and high-intensity workout atmosphere.'
  },
  {
    name: 'Evening Late',
    startTime: '07:00 PM',
    endTime: '10:00 PM',
    capacity: 40,
    crowdLevel: 'Medium',
    activity: 'Night Power Hours',
    desc: 'Great evening rhythm for winding down post-work stress with solid lifting.'
  }
];

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedSlot, setSelectedSlot] = useState(standardSlots[0]);
  const navigate = useNavigate();

  const isSunday = selectedDay === 'Sunday';

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><Clock size={14} /> STUDIO TIMINGS & SLOTS</p>
          <h1>DAILY TRAINING SCHEDULE & <em>SLOT CAPACITY</em></h1>
          <p className="lead-text">
            To prevent overcrowding and ensure personal room on every lifting platform, Vino Fitness Studio operates on verified slot reservations.
          </p>
        </div>

        {/* Day Selector Pills */}
        <div className="interactive-tab-bar">
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

        {/* Schedule Grid */}
        <div className="minimal-grid-3" style={{ maxWidth: '980px', margin: '0 auto 40px' }}>
          {standardSlots.map((slot) => {
            const isSelected = selectedSlot.name === slot.name;
            return (
              <div
                key={slot.name}
                className={'minimal-card ' + (isSelected ? 'selected' : '')}
                onClick={() => setSelectedSlot(slot)}
              >
                <div className="minimal-card-top">
                  <div className="minimal-card-icon"><Clock size={18} /></div>
                  <span
                    className="minimal-card-badge"
                    style={{
                      color: slot.crowdLevel === 'High' ? '#ff9900' : 'var(--lime)',
                      borderColor: slot.crowdLevel === 'High' ? '#5a3d00' : '#2f3e15'
                    }}
                  >
                    {slot.crowdLevel} Density
                  </span>
                </div>
                <h4>{slot.name}</h4>
                <div style={{ fontSize: '13px', color: 'var(--lime)', fontWeight: 600, marginBottom: '6px' }}>
                  {slot.startTime} – {slot.endTime}
                </div>
                <p style={{ fontSize: '11px', color: '#9ba58f', marginBottom: '10px' }}>{slot.activity}</p>
                <small style={{ fontSize: '10px', color: '#747d6d', borderTop: '1px solid #182012', paddingTop: '8px', display: 'block' }}>
                  Max Platform Capacity: {slot.capacity} Athletes
                </small>
              </div>
            );
          })}
        </div>

        {/* Selected Slot Interactive Summary & Booking */}
        <div className="interactive-card" style={{ maxWidth: '850px', margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--lime)', fontWeight: 700, letterSpacing: '0.1em' }}>
            SLOT RESERVATION PREVIEW
          </span>
          <h3 style={{ fontSize: '22px', color: '#ffffff', margin: '6px 0 8px' }}>
            {selectedDay} • {selectedSlot.name} ({selectedSlot.startTime} – {selectedSlot.endTime})
          </h3>
          <p style={{ fontSize: '13px', color: '#a5ada0', maxWidth: '580px', margin: '0 auto 18px', lineHeight: '1.6' }}>
            {selectedSlot.desc}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="lime-btn" onClick={() => navigate('/register')}>
              Reserve This Slot & Join <ArrowRight size={15} />
            </button>
            <button className="ghost-btn" onClick={() => navigate('/contact')}>
              Request Free Trial Pass
            </button>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1c2615', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '11px', color: '#858d7e' }}>
            <span><CheckCircle2 size={13} color="var(--lime)" style={{ display: 'inline', marginRight: '4px' }} /> Easy slot change in Member Dashboard</span>
            <span><ShieldCheck size={13} color="var(--lime)" style={{ display: 'inline', marginRight: '4px' }} /> Guaranteed platform availability</span>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

