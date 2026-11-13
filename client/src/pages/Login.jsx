import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Crown, Headphones, Dumbbell, UserRound, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Brand } from '../components/Brand';
import '../luxury-pages.css';

const DEMO_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'admin@pulsefit.com', password: 'admin123', icon: Crown },
  { role: 'reception', label: 'Reception', email: 'reception@pulsefit.com', password: 'reception123', icon: Headphones },
  { role: 'kiosk', label: 'Kiosk', email: 'kiosk@pulsefit.com', password: 'kiosk123', icon: Fingerprint },
  { role: 'trainer', label: 'Trainer', email: 'trainer@pulsefit.com', password: 'trainer123', icon: Dumbbell },
  { role: 'member', label: 'Member', email: 'member@pulsefit.com', password: 'member123', icon: UserRound },
];

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [show, setShow] = useState(false);
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const demoEnabled = import.meta.env.VITE_DEMO_MODE !== 'false';

  const signIn = async (credentials) => {
    setError('');
    setLoading(true);

    try {
      const user = await login(credentials);

      if (user.role === 'admin') {
        nav('/admin/dashboard');
      } else if (user.role === 'reception') {
        nav('/reception/dashboard');
      } else if (user.role === 'kiosk') {
        nav('/kiosk');
      } else if (user.role === 'trainer') {
        nav('/trainer/dashboard');
      } else if (user.role === 'member') {
        nav('/member/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    await signIn({ email, password, role });
  };

  const useDemo = async (account) => {
    setRole(account.role);
    setEmail(account.email);
    setPassword(account.password);
    await signIn({ role: account.role, email: account.email, password: account.password });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050705', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', position: 'relative' }}>
      {/* Ambient Apple Glow */}
      <div className="luxury-ambient-glow" style={{ top: '20%' }} />

      {/* Top Bar Navigation */}
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative', zIndex: 2 }}>
        <button
          onClick={() => nav('/')}
          style={{ background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
        >
          <ArrowLeft size={15} /> Back to studio
        </button>
        <span style={{ fontSize: '11px', color: '#636366', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Secure Portal
        </span>
      </div>

      {/* Luxury Frosted Glass Login Card */}
      <div 
        className="luxury-glass-card" 
        style={{ 
          width: '100%', 
          maxWidth: '440px', 
          padding: '40px 32px', 
          position: 'relative', 
          zIndex: 2,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" style={{ width: '48px', height: '48px', borderRadius: '12px', margin: '0 auto 14px', display: 'block' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#f5f5f7', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Sign In.
          </h2>
          <p style={{ fontSize: '13px', color: '#86868b', margin: 0 }}>
            Vino Fitness Studio workspace access
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '10px 14px', color: '#f87171', fontSize: '12px', marginBottom: '18px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Minimalist Segmented Role Control */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '22px', overflowX: 'auto' }}>
          {[
            { id: 'admin', label: 'Admin' },
            { id: 'reception', label: 'Staff' },
            { id: 'kiosk', label: 'Kiosk' },
            { id: 'trainer', label: 'Coach' },
            { id: 'member', label: 'Member' }
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              style={{
                flex: 1,
                border: 'none',
                background: role === r.id ? '#f5f5f7' : 'transparent',
                color: role === r.id ? '#000000' : '#86868b',
                fontWeight: role === r.id ? 600 : 500,
                fontSize: '11px',
                padding: '6px 10px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="e.g. admin@pulsefit.com"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 40px 12px 14px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', padding: 0 }}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="luxury-btn-primary"
            style={{ width: '100%', height: '44px', marginTop: '8px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : <>Sign In <ArrowRight size={14} /></>}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '12px' }}>
          <button
            type="button"
            onClick={() => nav('/register')}
            style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 500 }}
          >
            Register Membership
          </button>
          <button
            type="button"
            onClick={() => nav('/register')}
            style={{ background: 'none', border: 'none', color: '#86868b', cursor: 'pointer', padding: 0, fontSize: '12px' }}
          >
            Resume Registration
          </button>
        </div>

        {/* Demo Fast Login Pills */}
        {demoEnabled && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '10px', color: '#636366', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', textAlign: 'center', marginBottom: '10px', fontWeight: 600 }}>
              Quick Demo Access
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => useDemo(acc)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#d1d1d6',
                    fontSize: '11px',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
