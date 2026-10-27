import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, Loader2, Crown, Headphones, Dumbbell, UserRound, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Brand } from '../components/Brand';

const DEMO_ACCOUNTS = [
  { role: 'admin', label: 'Administrator', email: 'admin@pulsefit.com', password: 'admin123', icon: Crown, description: 'Full gym control' },
  { role: 'reception', label: 'Reception', email: 'reception@pulsefit.com', password: 'reception123', icon: Headphones, description: 'Members and payments' },
  { role: 'trainer', label: 'Trainer', email: 'trainer@pulsefit.com', password: 'trainer123', icon: Dumbbell, description: 'Clients and schedules' },
  { role: 'member', label: 'Member', email: 'member@pulsefit.com', password: 'member123', icon: UserRound, description: 'Personal membership' },
];

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [show, setShow] = useState(false);
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState('');
  const [error, setError] = useState('');
  const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

  const signIn = async credentials => {
    setError('');
    setLoading(true);

    try {
      const user = await login(credentials);
      
      // Redirect based on role
      if (user.role === 'admin') {
        nav('/admin/dashboard');
      } else if (user.role === 'reception') {
        nav('/reception/dashboard');
      } else if (user.role === 'trainer') {
        nav('/trainer/dashboard');
      } else if (user.role === 'member') {
        nav('/member/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.');
    } finally { setLoading(false); setActiveDemo(''); }
  };
  const submit = async (e) => {
    e.preventDefault();
    await signIn({ email, password, role });
  };
  const useDemo = async account => {
    setRole(account.role); setEmail(account.email); setPassword(account.password); setActiveDemo(account.role);
    await signIn({ role: account.role, email: account.email, password: account.password });
  };

  return (
    <main className="auth-page">
      <section className="auth-art">
        <Brand onClick={() => nav('/')} subtitle="UNISEX FITNESS STUDIO" size="md" />
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
        <form className="login-form" onSubmit={submit}>
          <div className="mini-mark">
            <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" className="brand-mini-logo" />
          </div>
          <h2>Sign in to Vino Fitness Studio</h2>
          <p>Access your studio performance workspace.</p>
          
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
          {demoEnabled && <section className="demo-access" aria-label="Demo accounts">
            <div className="demo-access-head"><div><span>LIVE DEMO</span><h3>Explore every workspace</h3></div><small>One-click secure demo access</small></div>
            <div className="demo-account-grid">
              {DEMO_ACCOUNTS.map(account => {
                const Icon = account.icon;
                const signingIn = loading && activeDemo === account.role;
                return <button type="button" className={`demo-account ${role === account.role ? 'selected' : ''}`} key={account.role} disabled={loading} onClick={() => useDemo(account)}>
                  <span className="demo-account-icon"><Icon size={18}/></span>
                  <span className="demo-account-copy"><strong>{account.label}</strong><small>{account.description}</small><code>{account.email}</code><code>{account.password}</code></span>
                  <span className="demo-account-action">{signingIn ? <Loader2 className="animate-spin" size={17}/> : <LogIn size={17}/>}</span>
                </button>;
              })}
            </div>
            <p><ShieldCheck size={14}/> Demo data only. Choose a role to sign in instantly.</p>
          </section>}
          <small className="secure"><ShieldCheck/> Secure account sign-in</small>
        </form>
      </section>
    </main>
  );
}
