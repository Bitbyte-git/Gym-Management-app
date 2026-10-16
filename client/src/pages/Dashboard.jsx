import Operations from './Operations';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, CreditCard, CalendarCheck, ReceiptIndianRupee, ChartNoAxesCombined, Search, Plus, ArrowUpRight, LogOut, Menu, X, ChevronRight, WalletCards, UserCheck, Clock3, Flame, Utensils, Target, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, dashboardService, memberService } from '../services';

const adminNav = [
  [LayoutDashboard, 'Overview', 'dashboard'], [Users, 'Members', 'members'],
  [Dumbbell, 'Trainers', 'trainers'], [CreditCard, 'Plans', 'plans'],
  [CreditCard, 'Memberships', 'memberships'], [CalendarCheck, 'Attendance', 'attendance'],
  [WalletCards, 'Payments', 'payments'], [UserCheck, 'Trainer assignments', 'allocations'],
  [Clock3, 'Gym slots', 'slots'], [CalendarCheck, 'Slot assignments', 'slotAllocations'], [Clock3, 'Opening hours', 'hours'],
  [CalendarCheck, 'Trainer availability', 'availability'], [ChartNoAxesCombined, 'Reports', 'reports'],
  [Users, 'Staff accounts', 'users'], [CalendarCheck, 'Notifications', 'notifications'],
  [LayoutDashboard, 'Settings', 'settings'], [ReceiptIndianRupee, 'Audit trail', 'audit'],
  [WalletCards, 'Stripe reconciliation', 'stripe'],
];
const receptionSections = ['dashboard', 'members', 'memberships', 'attendance', 'payments', 'slots', 'slotAllocations', 'notifications'];
const trainerNav = [[LayoutDashboard, 'Overview', 'dashboard'], [Users, 'My members', 'members'], [Clock3, 'My availability', 'availability'], [CalendarCheck, 'Notifications', 'notifications']];
const memberNav = [[LayoutDashboard, 'Overview', 'dashboard'], [Users, 'My profile', 'profile'], [CreditCard, 'Memberships', 'membership'], [CalendarCheck, 'Attendance', 'attendance'], [WalletCards, 'Payments', 'payments'], [Dumbbell, 'My trainer', 'coach'], [Clock3, 'My slot', 'schedule'], [CalendarCheck, 'Notifications', 'notifications']];

export default function Dashboard({ role = 'admin' }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const { user, logout } = useAuth();
  
  const current = loc.pathname.split('/').pop();
  const links = role === 'admin' ? (user?.role === 'reception' ? adminNav.filter(item => receptionSections.includes(item[2])) : adminNav) : role === 'trainer' ? trainerNav : memberNav;
  const title = links.find(x => x[2] === current)?.[1] || 'Overview';

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <div className="app-shell">
      <aside className={menu ? 'side open' : 'side'}>
        <div className="side-top">
          <button className="brand" onClick={() => nav('/')}>
            <span className="brand-mark">P</span>
            <span>PULSE<span>FIT</span><small>GYM OS</small></span>
          </button>
          <button className="close-side" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="location">
          <span>PF</span>
          <div>
            <b>PulseFit Central</b>
            <small>MG Road · Bengaluru</small>
          </div>
          <ChevronRight />
        </div>
        <nav>
          {links.map(([Icon, label, path]) => (
            <button
              className={current === path ? 'active' : ''}
              key={path}
              onClick={() => {
                nav(`/${role}/${path}`);
                setMenu(false);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={handleLogout}>
            <LogOut />
            Sign out
          </button>
          <div className="user-chip">
            <span>{user?.name?.split(' ').map(n => n[0]).join('') || 'U'}</span>
            <div>
              <b>{user?.name || 'User'}</b>
              <small>{user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : role}</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button className="mobile-menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
            </p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <label>
              <Search />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search records…"
              />
            </label>
            {role === 'admin' && <button className="lime-btn" onClick={() => nav('/register')}>
              <Plus /> Register member
            </button>}
            {role === 'member' && <button className="lime-btn" onClick={() => nav('/member/membership')}>
              <Plus /> View membership
            </button>}
          </div>
        </header>
        {current === 'dashboard' && <Overview role={role} onNavigate={nav} />}
        {current !== 'dashboard' && (links.some(item => item[2] === current)
          ? <Operations section={current} user={user} query={query}/>
          : <div className="dash-content"><p>This section is unavailable for your role.</p></div>)}
      </main>
    </div>
  );
}

function Overview({ role, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [membersError, setMembersError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, [role]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    setMembersError('');
    try {
      const statsResponse = await dashboardService[
        role === 'admin' ? 'getAdminStats' :
        role === 'trainer' ? 'getTrainerStats' :
        'getMemberStats'
      ]();
      setStats(statsResponse.data.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Could not load dashboard data. Please try again.');
      return;
    } finally {
      setLoading(false);
    }
    if (role === 'admin') {
      try {
        const membersResponse = await memberService.getAll({ limit: 5 });
        setMembers(membersResponse.data.data.members || []);
      } catch (err) {
        setMembersError(err.response?.data?.error || 'Could not load recent members.');
      }
    }
  };

  if (loading) {
    return (
      <div className="dash-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 className="animate-spin" size={48} style={{ color: 'var(--lime)' }} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="dash-content">
        <div className="table-card management-message error-message" role="alert">
          {loadError}
          <button className="outline-btn" onClick={loadDashboardData}>Retry</button>
        </div>
      </div>
    );
  }
  if (role === 'member') return <MemberOverview user={user} stats={stats} onNavigate={onNavigate} />;

  const trainer = role === 'trainer';
  const displayStats = trainer ?
    [
      [Users, 'Assigned members', stats?.assignedClients ?? 0, 'Active assignments'],
      [CalendarCheck, "Today's sessions", stats?.todaySessions ?? 0, 'Across your members'],
    ] :
    [
      [Users, 'Total members', stats?.totalMembers ?? 0, 'Registered member profiles'],
      [UserCheck, 'Active members', stats?.activeMembers ?? 0, 'Current membership status'],
      [CalendarCheck, "Today's check-ins", stats?.todayCheckins ?? 0, 'Attendance records'],
      [WalletCards, 'Monthly revenue', `₹${stats?.monthlyRevenue ?? 0}`, 'Completed payments this month']
    ];

  return (
    <div className="dash-content">
      <div className="welcome">
        <div>
          <h2>{trainer ? 'Your members are moving.' : `Good morning, ${user?.name || 'User'}.`}</h2>
          <p>{trainer ? 'Here is what your coaching day looks like.' : 'Here\'s the pulse of your gym today.'}</p>
        </div>
        {role === 'admin' && <button className="outline-btn" onClick={() => onNavigate('/admin/reports')}>View reports</button>}
      </div>
      <section className="stats">
        {displayStats.map(([Icon, l, n, s]) => (
          <article key={l}>
            <div><Icon /></div>
            <p>{l}</p>
            <h3>{n}</h3>
            <span><ArrowUpRight /> {s}</span>
          </article>
        ))}
      </section>
      {role === 'admin' && (membersError
        ? <div className="table-card management-message error-message" role="alert">{membersError}</div>
        : <MemberTable compact rows={members} onViewAll={() => onNavigate('/admin/members')} />)}
    </div>
  );
}

function MemberOverview({ user, stats, onNavigate }) {
  const membership = stats?.membership;
  const attendance = stats?.todayAttendance;
  const member = stats?.member || user?.profile;
  return (
    <div className="dash-content">
      <div className="welcome">
        <div>
          <h2>Keep showing up, {user?.name || 'Member'}.</h2>
          <p>Your membership and attendance information from PulseFit.</p>
        </div>
        <button className="outline-btn" onClick={() => onNavigate('/member/attendance')}>View attendance</button>
      </div>
      <section className="member-hero">
        <article>
          <span>MEMBERSHIP</span>
          <b>{membership?.status?.toUpperCase() || 'NO ACTIVE PLAN'}</b>
          <h2>{membership?.membershipPlan?.name || 'Membership not active'}</h2>
          <p>{membership
            ? `${new Date(membership.startDate).toLocaleDateString()} — ${new Date(membership.endDate).toLocaleDateString()}`
            : 'Contact reception to review membership options.'}</p>
          <div><strong>{membership ? stats?.remainingDays ?? 0 : '—'}</strong><small>days remaining</small></div>
        </article>
        <article className="today">
          <p>TODAY'S ATTENDANCE</p>
          <h2>{attendance ? 'Attendance recorded' : 'No attendance record'}</h2>
          <span><Clock3 /> {attendance?.checkInTime
            ? new Date(attendance.checkInTime).toLocaleTimeString()
            : 'No check-in today'}</span>
          <span><Flame /> {attendance?.checkOutTime
            ? `${attendance.duration} minutes`
            : attendance?.checkInTime ? 'Currently checked in' : 'Attendance is recorded by reception'}</span>
        </article>
        <article className="coach">
          <p>YOUR PROFILE</p>
          <div>
            <i>{member?.avatarInitials || 'M'}</i>
            <h3>{member?.fullName || user?.name || 'Member'}<small>{member?.fitnessGoal?.replaceAll('_', ' ') || 'Fitness goal not set'}</small></h3>
          </div>
          <span>{member?.height ? `${member.height} cm` : 'Height not recorded'} · {member?.weight ? `${member.weight} kg` : 'Weight not recorded'}</span>
        </article>
      </section>
    </div>
  );
}

function MemberTable({ compact = false, rows = [], onViewAll }) {
  return (
    <section className="table-card">
      <div className="card-head">
        <div>
          <p>{compact ? 'RECENT MEMBERS' : 'DIRECTORY'}</p>
          <h3>{compact ? 'Latest registrations' : 'All members'}</h3>
        </div>
        {compact && <button onClick={onViewAll}>View all <ChevronRight /></button>}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Mobile</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m._id}>
                <td>
                  <div className="member-cell">
                    <i>{m.avatarInitials || m.fullName?.split(' ').map(n => n[0]).join('') || 'M'}</i>
                    <span>
                      <b>{m.fullName || 'Unknown'}</b>
                      <small>{m.memberId || m._id}</small>
                    </span>
                  </div>
                </td>
                  <td>{m.mobileNumber || '—'}</td>
                  <td><span className={'status ' + (m.registrationStatus || 'pending').toLowerCase()}>{m.registrationStatus || 'Pending'}</span></td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
