import { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, Phone, Mail, Clock, MapPin } from 'lucide-react';
import { Brand } from './Brand';

const memberNavLinks = [
  { label: 'Programs', path: '/programs' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Trainers', path: '/trainers' },
  { label: 'Memberships', path: '/memberships' },
  { label: 'Facilities', path: '/facilities' },
  { label: 'Contact', path: '/contact' }
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="nav studio-navbar">
      <Brand onClick={() => navigate('/')} subtitle="UNISEX FITNESS STUDIO" size="lg" />

      <nav className={open ? 'open' : ''}>
        {memberNavLinks.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        {/* Mobile menu action buttons */}
        <div className="mobile-only-actions" style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          <button className="outline-btn" onClick={() => { setOpen(false); navigate('/login'); }}>
            Member Login
          </button>
          <button className="lime-btn" onClick={() => { setOpen(false); navigate('/register'); }}>
            Join Studio <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      <div className="nav-desktop-actions">
        <button
          className="ghost-btn"
          style={{ height: '38px', minHeight: '38px', fontSize: '11px', padding: '0 15px', borderRadius: '4px' }}
          onClick={() => navigate('/login')}
        >
          Member Login
        </button>
        <button
          className="lime-btn"
          style={{ height: '38px', minHeight: '38px', fontSize: '11px', padding: '0 18px', borderRadius: '4px' }}
          onClick={() => navigate('/register')}
        >
          Join Studio <ArrowRight size={15} />
        </button>
      </div>

      <button
        className="menu"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation menu"
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}

export function PublicFooter() {
  const navigate = useNavigate();

  return (
    <footer className="studio-footer">
      <div className="wrap studio-footer-wrap">
        <div className="studio-footer-grid">
          {/* Col 1: Brand & Bio */}
          <div className="studio-footer-brand-col">
            <Brand onClick={() => navigate('/')} as="div" size="md" subtitle="UNISEX FITNESS STUDIO" />
            <p className="studio-footer-desc">
              Coimbatore's elite unisex fitness destination. Powered by Olympic strength platforms, certified personal coaching, and smart biometric check-in.
            </p>
            <div className="studio-footer-contact-chips">
              <a href="tel:+919876543210" className="footer-chip">
                <Phone size={13} /> +91 98765 43210
              </a>
              <a href="mailto:contact@vinofitness.com" className="footer-chip">
                <Mail size={13} /> contact@vinofitness.com
              </a>
            </div>
          </div>

          {/* Col 2: Training Disciplines */}
          <div className="studio-footer-nav-col">
            <h4>TRAINING</h4>
            <Link to="/programs">Strength & Power</Link>
            <Link to="/programs">HIIT Conditioning</Link>
            <Link to="/programs">Functional Crossfit</Link>
            <Link to="/programs">1-on-1 Personal Coaching</Link>
            <Link to="/programs">Mobility & Yoga Flow</Link>
          </div>

          {/* Col 3: Studio & Amenities */}
          <div className="studio-footer-nav-col">
            <h4>STUDIO</h4>
            <Link to="/schedule">Daily Slots & Hours</Link>
            <Link to="/trainers">Certified Coaching Roster</Link>
            <Link to="/memberships">Membership Plans</Link>
            <Link to="/facilities">Equipment & Amenities</Link>
            <Link to="/contact">Book 1-Day Trial Pass</Link>
          </div>

          {/* Col 4: Member Portal & Studio Info */}
          <div className="studio-footer-action-col">
            <h4>MEMBER ACCESS</h4>
            <div className="footer-action-box">
              <div className="footer-timings">
                <div className="timing-row">
                  <Clock size={13} color="var(--lime)" />
                  <span>Morning Class: <b>05:00 AM – 10:00 AM</b></span>
                </div>
                <div className="timing-row">
                  <Clock size={13} color="var(--lime)" />
                  <span>Evening Class: <b>05:00 PM – 09:00 PM</b></span>
                </div>
              </div>
              <div className="footer-buttons-group">
                <button className="footer-btn ghost" onClick={() => navigate('/login')}>
                  Member Login
                </button>
                <button className="footer-btn lime" onClick={() => navigate('/register')}>
                  Join Studio <ArrowRight size={13} />
                </button>
              </div>
              <p className="footer-address">
                <MapPin size={13} color="var(--lime)" /> Race Course Road, Coimbatore – 641018
              </p>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="studio-footer-bottom">
          <small>© 2026 VINO FITNESS STUDIO. All rights reserved.</small>
          <a href="https://bitbytetech.org"> <span className="studio-footer-motto">
            <small>  Designed, Developed, Hosted and Maintained by</small> Bit Byte Technologies
          </span></a>
          <div className="studio-footer-legal">
            <Link to="/contact">Privacy Policy</Link>
            <span>&bull;</span>
            <Link to="/contact">Terms of Membership</Link>
            <span>&bull;</span>
            <Link to="/contact">Safety Rules</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className={`landing ${isHome ? 'is-home' : 'is-subpage'}`}>
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
