import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../schedule-enhanced.css';

const days = [
  { id: 'mon', label: 'Mon', full: 'Monday' },
  { id: 'tue', label: 'Tue', full: 'Tuesday' },
  { id: 'wed', label: 'Wed', full: 'Wednesday' },
  { id: 'thu', label: 'Thu', full: 'Thursday' },
  { id: 'fri', label: 'Fri', full: 'Friday' },
  { id: 'sat', label: 'Sat', full: 'Saturday' },
  { id: 'sun', label: 'Sun', full: 'Sunday', isSunday: true },
];

const shiftsData = {
  morning: {
    id: 'morning',
    shift: 'Morning Shift',
    time: '05:00 — 10:00 AM',
    duration: '5 Hours',
    title: 'Morning Class',
    subtitle: 'Strength, hypertrophy & morning conditioning',
    icon: Sun,
    slots: [
      { id: 'm1', time: '05:00 — 07:00 AM', name: 'Early Risers Strength', status: 'Available' },
      { id: 'm2', time: '07:00 — 10:00 AM', name: 'Prime Morning Coaching', status: 'Available' },
    ]
  },
  evening: {
    id: 'evening',
    shift: 'Evening Shift',
    time: '05:00 — 09:00 PM',
    duration: '4 Hours',
    title: 'Evening Class',
    subtitle: 'Peak strength, power hours & conditioning',
    icon: Moon,
    slots: [
      { id: 'e1', time: '05:00 — 07:00 PM', name: 'Prime Evening Strength', status: 'Available' },
      { id: 'e2', time: '07:00 — 09:00 PM', name: 'Night Power Hours', status: 'Available' },
    ]
  }
};

export default function Schedule() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedSlot, setSelectedSlot] = useState(shiftsData.morning.slots[0]);

  const isSunday = selectedDay.isSunday;

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-schedule-wrap">
          {/* Subtle Ambient Apple Glow */}
          <div className="luxury-ambient-glow" />

          {/* Minimalist Header */}
          <div className="luxury-hero">
            <span className="luxury-badge">Studio Timings</span>
            <h1 className="luxury-title">
              The <span>Schedule</span>.
            </h1>
            <p className="luxury-lead">
              Two curated daily shifts. Designed for uninterrupted lifting and guaranteed platform access.
            </p>
          </div>

          {/* Day Selector Segmented Track */}
          <div className="luxury-day-track">
            {days.map((d) => (
              <button
                key={d.id}
                className={`luxury-day-pill ${selectedDay.id === d.id ? 'active' : ''} ${d.isSunday ? 'is-sun' : ''}`}
                onClick={() => setSelectedDay(d)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Luxury Shifts Grid (2 Monolithic Cards) */}
          <div className="luxury-shifts-grid">
            {/* Morning Shift */}
            <div className={`luxury-shift-card ${selectedSlot.id.startsWith('m') ? 'active-shift' : ''}`}>
              <div className="luxury-card-eyebrow">
                <span className="luxury-shift-tag">Morning Class</span>
                <span className="luxury-time-pill">{shiftsData.morning.duration}</span>
              </div>
              <div className="luxury-card-time">{shiftsData.morning.time}</div>
              <div className="luxury-card-name">Strength & Hypertrophy</div>
              <p className="luxury-card-sub">{shiftsData.morning.subtitle}</p>

              <div className="luxury-slots-wrap">
                {shiftsData.morning.slots.map((slot) => {
                  const isSelected = selectedSlot.id === slot.id;
                  return (
                    <div
                      key={slot.id}
                      className={`luxury-slot-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <div className="luxury-slot-row-left">
                        <span className="luxury-slot-row-time">{slot.time}</span>
                        <span className="luxury-slot-row-desc">{slot.name}</span>
                      </div>
                      <div className="luxury-slot-row-right">
                        <span className="luxury-slot-status">{slot.status}</span>
                        <div className="luxury-slot-radio">
                          <div className="luxury-slot-radio-dot" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evening Shift */}
            <div className={`luxury-shift-card ${selectedSlot.id.startsWith('e') ? 'active-shift' : ''} ${isSunday ? 'sunday-closed' : ''}`}>
              <div className="luxury-card-eyebrow">
                <span className="luxury-shift-tag">Evening Class</span>
                <span className="luxury-time-pill">
                  {isSunday ? 'Closed' : shiftsData.evening.duration}
                </span>
              </div>
              <div className="luxury-card-time">{shiftsData.evening.time}</div>
              <div className="luxury-card-name">
                {isSunday ? 'Sunday Maintenance' : 'Power & Conditioning'}
              </div>
              <p className="luxury-card-sub">
                {isSunday ? 'Evening closed for weekly deep sanitization' : shiftsData.evening.subtitle}
              </p>

              <div className="luxury-slots-wrap">
                {!isSunday ? (
                  shiftsData.evening.slots.map((slot) => {
                    const isSelected = selectedSlot.id === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`luxury-slot-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <div className="luxury-slot-row-left">
                          <span className="luxury-slot-row-time">{slot.time}</span>
                          <span className="luxury-slot-row-desc">{slot.name}</span>
                        </div>
                        <div className="luxury-slot-row-right">
                          <span className="luxury-slot-status">{slot.status}</span>
                          <div className="luxury-slot-radio">
                            <div className="luxury-slot-radio-dot" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#86868b', fontSize: '13px' }}>
                    Sunday morning open from 06:00 — 10:00 AM
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Minimalist Break Bar */}
          <div className="luxury-break-bar">
            Studio break & sanitization from <strong>10:00 AM to 5:00 PM</strong> daily.
          </div>

          {/* Floating Luxury Action Pill */}
          <div className="luxury-action-pill">
            <div className="luxury-action-info">
              <span className="luxury-action-day">{selectedDay.full}</span>
              <span className="luxury-action-slot">
                {selectedSlot.time} • {selectedSlot.name}
              </span>
            </div>
            <button className="luxury-action-btn" onClick={() => navigate('/register')}>
              Reserve Slot <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
