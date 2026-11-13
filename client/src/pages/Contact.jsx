import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import '../luxury-pages.css';

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="luxury-page-wrap">
          <div className="luxury-ambient-glow" />

          {/* Minimal Hero */}
          <div className="luxury-hero">
            <span className="luxury-badge">Concierge</span>
            <h1 className="luxury-title">
              Get In <span>Touch</span>.
            </h1>
            <p className="luxury-lead">
              Visit the studio floor or request your complimentary 1-day workout trial pass.
            </p>
          </div>

          <div className="luxury-grid-2">
            {/* Left: Studio Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="luxury-glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', color: '#f5f5f7', margin: '0 0 4px', fontWeight: 600 }}>Studio Location</h4>
                    <p style={{ fontSize: '13px', color: '#86868b', margin: '0 0 2px', lineHeight: 1.4 }}>
                      Vino Fitness Studio, Race Course Road, Coimbatore, Tamil Nadu – 641018
                    </p>
                  </div>
                </div>
              </div>

              <div className="luxury-glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
                    <Phone size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', color: '#f5f5f7', margin: '0 0 4px', fontWeight: 600 }}>Reception Hotline</h4>
                    <p style={{ fontSize: '13px', color: '#f5f5f7', margin: '0 0 2px', fontWeight: 600 }}>
                      +91 98765 43210 &nbsp;•&nbsp; +91 94421 88990
                    </p>
                    <small style={{ fontSize: '11px', color: '#86868b' }}>Mon – Sat: 5:00 AM – 9:00 PM</small>
                  </div>
                </div>
              </div>

              <div className="luxury-glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lime)', flexShrink: 0 }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', color: '#f5f5f7', margin: '0 0 4px', fontWeight: 600 }}>Studio Hours</h4>
                    <p style={{ fontSize: '13px', color: '#86868b', margin: 0 }}>
                      Morning: <strong style={{ color: '#f5f5f7' }}>5:00 AM – 10:00 AM</strong><br />
                      Evening: <strong style={{ color: '#f5f5f7' }}>5:00 PM – 9:00 PM</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Clean Minimal Request Card */}
            <div className="luxury-glass-card" style={{ padding: '32px' }}>
              {!submitted ? (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', color: '#f5f5f7', margin: '0 0 6px', fontWeight: 600 }}>
                      Request Complimentary Trial
                    </h3>
                    <p style={{ fontSize: '13px', color: '#86868b', margin: 0 }}>
                      Leave your details. We will confirm your 1-day pass via SMS / WhatsApp.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mobile Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 98765 43210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <button type="submit" className="luxury-btn-primary" style={{ marginTop: '8px' }}>
                    Submit Pass Request <ArrowRight size={14} />
                  </button>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <CheckCircle2 size={44} color="var(--lime)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '20px', color: '#f5f5f7', margin: '0 0 8px', fontWeight: 600 }}>Pass Requested</h3>
                  <p style={{ fontSize: '13px', color: '#86868b', margin: 0, lineHeight: 1.5 }}>
                    Thank you, {form.name}. Our concierge team will send your studio pass via SMS to {form.phone}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
