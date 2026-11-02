import { useState } from 'react';
import {
  MapPin, Phone, Mail, Clock, MessageSquare, Send, CheckCircle2,
  Sparkles, Dumbbell
} from 'lucide-react';
import PublicLayout from '../components/PublicLayout';

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    type: '1-Day Free Trial Workout Pass',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div className="page-shell wrap">
        <div className="page-hero">
          <p className="eyebrow"><Dumbbell size={14} /> VISIT VINO FITNESS STUDIO</p>
          <h1>VISIT OUR STUDIO OR <em>CLAIM A FREE PASS</em></h1>
          <p className="lead-text">
            Experience elite training, tour our facilities, or speak directly with our head coach. Claim your complimentary 1-day workout trial pass below.
          </p>
        </div>

        <div className="contact-layout-grid" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Studio Contact Information */}
          <div className="contact-info-panel">
            <div className="contact-info-card">
              <div className="card-icon"><MapPin size={22} /></div>
              <div>
                <h4>Studio & Facilities</h4>
                <p>Vino Fitness Studio, Race Course Road, Coimbatore, Tamil Nadu – 641018</p>
                <small>Equipped with Olympic lifting bays, biometric kiosks & recovery lounge</small>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="card-icon"><Phone size={22} /></div>
              <div>
                <h4>Reception Hotlines</h4>
                <p>+91 98765 43210 &nbsp;•&nbsp; +91 94421 88990</p>
                <small>Available Monday through Saturday: 05:00 AM to 10:00 PM</small>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="card-icon"><Mail size={22} /></div>
              <div>
                <h4>Official Email</h4>
                <p>contact@vinofitness.com &nbsp;•&nbsp; info@vinofitness.com</p>
                <small>Fast response within 2 business hours</small>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="card-icon"><Clock size={22} /></div>
              <div>
                <h4>Gym Operating Hours</h4>
                <p>Monday – Saturday: 05:00 AM – 10:00 PM</p>
                <p>Sunday: 06:00 AM – 01:00 PM & 04:00 PM – 08:00 PM</p>
              </div>
            </div>

            <div className="contact-fast-grid">
              <a className="contact-fast-btn" href="tel:+919876543210">
                <Phone size={15} /> Call Reception
              </a>
              <a
                className="contact-fast-btn"
                href="https://wa.me/919876543210?text=Hi%20Vino%20Fitness%20Studio,%20I%20would%20like%20to%20claim%20my%201-day%20free%20trial%20pass."
                target="_blank"
                rel="noreferrer"
              >
                <MessageSquare size={15} /> WhatsApp Concierge
              </a>
            </div>
          </div>

          {/* Trial Pass / Inquiry Form */}
          <div className="contact-form-panel">
            <h3>Claim 1-Day Free Trial Pass</h3>
            <p className="form-subtitle">
              Fill out your details below and our studio team will reserve your complimentary workout session pass.
            </p>

            {submitted ? (
              <div className="contact-success-state">
                <div className="success-icon"><CheckCircle2 size={34} /></div>
                <h4>Workout Pass Reserved!</h4>
                <p>
                  Thank you, <strong>{form.name}</strong>! Your 1-Day Trial Pass has been reserved. Our studio concierge will contact you via WhatsApp/Call to confirm your preferred session time.
                </p>
                <button
                  className="contact-reset-btn"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: '', phone: '', email: '', type: '1-Day Free Trial Workout Pass', message: '' });
                  }}
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="landing-form-grid">
                  <div className="landing-form-field">
                    <label htmlFor="contact-name">Full Name *</label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      placeholder="e.g. Ramesh Krishnan"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="landing-form-field">
                    <label htmlFor="contact-phone">Mobile Number *</label>
                    <input
                      id="contact-phone"
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>

                  <div className="landing-form-field full-span">
                    <label htmlFor="contact-email">Email Address</label>
                    <input
                      id="contact-email"
                      type="email"
                      placeholder="ramesh@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>

                  <div className="landing-form-field full-span">
                    <label htmlFor="contact-type">Inquiry Type</label>
                    <select
                      id="contact-type"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="1-Day Free Trial Workout Pass">1-Day Free Trial Workout Pass</option>
                      <option value="Studio Membership Inquiry">Studio Membership Inquiry</option>
                      <option value="1-on-1 Personal Training Consultation">1-on-1 Personal Training Consultation</option>
                      <option value="Studio Walkthrough & Facility Tour">Studio Walkthrough & Facility Tour</option>
                    </select>
                  </div>

                  <div className="landing-form-field full-span">
                    <label htmlFor="contact-msg">Fitness Goals or Questions (Optional)</label>
                    <textarea
                      id="contact-msg"
                      placeholder="Tell us about your fitness background, goals (e.g. fat loss, strength), or preferred slot..."
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </div>
                </div>

                <button type="submit" className="contact-submit-btn">
                  Claim Free Workout Pass <Send size={15} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
