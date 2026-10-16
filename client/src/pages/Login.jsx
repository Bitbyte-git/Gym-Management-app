import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [show, setShow] = useState(false);
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login({ email, password, role });
      setLoading(false);
      
      // Redirect based on role
      if (user.role === 'admin' || user.role === 'reception') {
        nav('/admin/dashboard');
      } else if (user.role === 'trainer') {
        nav('/trainer/dashboard');
      } else if (user.role === 'member') {
        nav('/member/dashboard');
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-art">
        <button className="brand" onClick={() => nav('/')}>
          <span className="brand-mark">P</span>
          <span>PULSE<span>FIT</span><small>GYM OS</small></span>
        </button>
        <div>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>YOUR GYM.<br/><em>FULLY IN MOTION.</em></h1>
          <p>Everything you need to lead your team, serve members and grow stronger.</p>
        </div>
        <small>Trusted by 5,000+ fitness businesses</small>
      </section>
      <section className="auth-form">
        <button className="back" onClick={() => nav('/')}>
          <ArrowLeft/> Back to home
        </button>
        <form onSubmit={submit}>
          <span className="mini-mark">P</span>
          <h2>Sign in to PulseFit</h2>
          <p>Access your performance workspace.</p>
          
          {error && <div className="error-message" style={{ color: '#ff4444', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255,68,68,0.1)', borderRadius: '4px' }}>{error}</div>}
          
          <label>Workspace role
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">Gym administrator</option>
              <option value="reception">Reception / Staff</option>
              <option value="trainer">Trainer</option>
              <option value="member">Member</option>
            </select>
          </label>
          <label>Email address
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
              placeholder="Enter your email"
            />
          </label>
          <label>Password
            <div className="password">
              <input 
                type={show ? 'text' : 'password'} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required 
                placeholder="Enter your password"
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? <EyeOff/> : <Eye/>}
              </button>
            </div>
          </label>
          <p><button type="button" className="back" onClick={() => nav('/register')}>New member? Register yourself</button></p>
          <p><button type="button" className="back" onClick={() => nav('/register')}>Pending registration? Resume here</button></p>
          <button className="lime-btn full" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="animate-spin"/> Signing in...</> : <>Sign in securely <ArrowRight/></>}
          </button>
          {import.meta.env.DEV && <details className="demo-credentials"><summary>Local demo accounts (run npm run seed)</summary>
            {[
              ['admin', 'admin@pulsefit.com', 'admin123'], ['reception', 'reception@pulsefit.com', 'reception123'],
              ['trainer', 'trainer@pulsefit.com', 'trainer123'], ['member', 'member@pulsefit.com', 'member123'],
            ].map(([accountRole, accountEmail, accountPassword]) => <button type="button" className="back" key={accountRole}
              onClick={() => { setRole(accountRole); setEmail(accountEmail); setPassword(accountPassword); }}>
              {accountRole}: {accountEmail} / {accountPassword}
            </button>)}
          </details>}
          <small className="secure"><ShieldCheck/> Secure account sign-in</small>
        </form>
      </section>
    </main>
  );
}
