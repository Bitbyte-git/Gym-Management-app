import Operations from './Operations';
import Biometrics from './Biometrics';
import { Brand } from '../components/Brand';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, CreditCard, CalendarCheck, ReceiptIndianRupee, ChartNoAxesCombined, Search, Plus, ArrowUpRight, LogOut, Menu, X, ChevronRight, WalletCards, UserCheck, Clock3, Flame, Utensils, Target, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, dashboardService, memberService } from '../services';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const CHART_COLORS = ['#c9ff18', '#7fa80c', '#ecb338', '#54b8a7', '#e06a5f'];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const gymDateKey = (value = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const recentGymDates = count => {
  const [year, month, day] = gymDateKey().split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (count - 1 - index), 12));
    return date.toISOString().slice(0, 10);
  });
};

const adminNav = [
  [LayoutDashboard, 'Overview', 'dashboard'], [Users, 'Members', 'members'], [UserCheck, 'Fingerprints', 'biometrics'],
  [Dumbbell, 'Trainers', 'trainers'], [CreditCard, 'Membership plans', 'plans'],
  [CreditCard, 'Member memberships', 'memberships'], [CalendarCheck, 'Check-in & attendance', 'attendance'],
  [WalletCards, 'Payments & receipts', 'payments'], [UserCheck, 'Member trainers', 'allocations'],
  [Clock3, 'Daily time slots', 'slots'], [CalendarCheck, 'Member slot assignments', 'slotAllocations'], [Clock3, 'Opening hours', 'hours'],
  [CalendarCheck, 'Trainer availability', 'availability'], [ChartNoAxesCombined, 'Reports', 'reports'],
  [Users, 'Staff accounts', 'users'], [CalendarCheck, 'Notifications', 'notifications'],
  [LayoutDashboard, 'Settings', 'settings'], [ReceiptIndianRupee, 'Audit trail', 'audit'],
];
const receptionSections = ['biometrics', 'dashboard', 'members', 'memberships', 'attendance', 'payments', 'slots', 'slotAllocations', 'notifications'];
const trainerNav = [[LayoutDashboard, 'Overview', 'dashboard'], [Users, 'My members', 'members'], [Clock3, 'My availability', 'availability'], [CalendarCheck, 'Notifications', 'notifications']];
const memberNav = [[UserCheck, 'Fingerprint', 'biometrics'], [LayoutDashboard, 'Overview', 'dashboard'], [Users, 'My profile', 'profile'], [CreditCard, 'Memberships', 'membership'], [CalendarCheck, 'Attendance', 'attendance'], [WalletCards, 'Payments', 'payments'], [Dumbbell, 'My trainer', 'coach'], [Clock3, 'My slot', 'schedule'], [CalendarCheck, 'Notifications', 'notifications']];

export default function Dashboard({ role = 'admin' }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const { user, logout } = useAuth();
  
  const current = loc.pathname.split('/').pop();
  const staffWorkspace = role === 'admin' || role === 'reception';
  const links = staffWorkspace ? (role === 'reception' ? adminNav.filter(item => receptionSections.includes(item[2])) : adminNav) : role === 'trainer' ? trainerNav : memberNav;
  const title = links.find(x => x[2] === current)?.[1] || 'Overview';

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <div className="app-shell">
      <aside className={menu ? 'side open' : 'side'}>
        <div className="side-top">
          <Brand onClick={() => nav('/')} subtitle="UNISEX FITNESS STUDIO" size="md" />
          <button className="close-side" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="location">
          <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" className="location-logo" />
          <div>
            <b>Vino Fitness Studio</b>
            <small>Unisex Fitness Studio</small>
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
            {staffWorkspace && (current !== 'dashboard' || user?.role !== 'admin') && <button className="lime-btn" onClick={() => nav('/register')}>
              <Plus /> Register member
            </button>}
            {role === 'member' && <button className="lime-btn" onClick={() => nav('/member/membership')}>
              <Plus /> View membership
            </button>}
          </div>
        </header>
        {current === 'dashboard' && <Overview role={role} onNavigate={nav} />}
        {current !== 'dashboard' && (links.some(item => item[2] === current)
          ? current === 'biometrics' ? <Biometrics user={user} /> : <Operations section={current} user={user} query={query}/>
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
  }, [role, user?.role]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    setMembersError('');
    try {
      const statsResponse = await dashboardService[
        role === 'admin' || role === 'reception' ? 'getAdminStats' :
        role === 'trainer' ? 'getTrainerStats' :
        'getMemberStats'
      ]();
      let dashboardData = statsResponse.data.data;
      if (role === 'admin' && user?.role === 'admin') {
        const attendanceDates = recentGymDates(7);
        const [revenueResult, attendanceResult, membershipsResult, slotsResult] = await Promise.allSettled([
          api.get('/reports/revenue'),
          api.get('/reports/attendance', { params: { startDate: attendanceDates[0], endDate: attendanceDates[6] } }),
          api.get('/reports/memberships'),
          api.get('/reports/slot-utilization'),
        ]);
        if (revenueResult.status === 'fulfilled') {
          const revenueResponse = revenueResult.value;
          const revenueData = revenueResponse.data.data || {};
          const monthlyBreakdown = revenueData.monthlyBreakdown || [];
          const paymentMethods = (revenueData.payments || []).reduce((methods, payment) => {
            const name = payment.paymentMethod || 'unknown';
            const existing = methods.get(name) || { name, value: 0, payments: 0 };
            existing.value += Number(payment.amount) || 0;
            existing.payments += 1;
            methods.set(name, existing);
            return methods;
          }, new Map());
          dashboardData = {
            ...dashboardData,
            revenueTrend: monthlyBreakdown.map(item => ({
              year: item._id.year,
              month: item._id.month,
              revenue: Number(item.total) || 0,
              payments: Number(item.count) || 0,
            })),
            paymentMethodDistribution: [...paymentMethods.values()].sort((a, b) => b.value - a.value),
          };
        }
        if (attendanceResult.status === 'fulfilled') {
          const records = attendanceResult.value.data.data?.attendance || [];
          const counts = records.reduce((totals, record) => {
            const key = gymDateKey(record.checkInTime || record.attendanceDate);
            totals[key] = (totals[key] || 0) + 1;
            return totals;
          }, {});
          dashboardData = {
            ...dashboardData,
            attendanceTrend: attendanceDates.map(date => ({ date, checkIns: counts[date] || 0 })),
          };
        }
        if (membershipsResult.status === 'fulfilled') {
          const byStatus = membershipsResult.value.data.data?.summary?.byStatus || {};
          dashboardData = {
            ...dashboardData,
            membershipDistribution: Object.entries(byStatus).map(([name, value]) => ({ name, value: Number(value) || 0 })),
          };
        }
        if (slotsResult.status === 'fulfilled') {
          const utilization = slotsResult.value.data.data?.utilization || [];
          const groupedSlots = utilization.reduce((groups, slot) => {
            const key = `${slot.name}|${slot.startTime}|${slot.endTime}`;
            const existing = groups.get(key) || {
              name: slot.name,
              time: `${slot.startTime}-${slot.endTime}`,
              members: 0,
              capacity: Number(slot.maxCapacity) || 0,
            };
            existing.members += Number(slot.currentAllocations) || 0;
            existing.capacity = Math.max(existing.capacity, Number(slot.maxCapacity) || 0);
            groups.set(key, existing);
            return groups;
          }, new Map());
          dashboardData = {
            ...dashboardData,
            slotUtilization: [...groupedSlots.values()].map(slot => ({
              ...slot,
              utilization: slot.capacity ? Math.round(slot.members / slot.capacity * 100) : 0,
            })),
          };
        }
      }
      setStats(dashboardData);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Could not load dashboard data. Please try again.');
      return;
    } finally {
      setLoading(false);
    }
    if (role === 'admin' || role === 'reception') {
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
  const staffWorkspace = role === 'admin' || role === 'reception';
  const administrator = user?.role === 'admin';
  const displayStats = trainer ?
    [
      [Users, 'Assigned members', stats?.assignedClients ?? 0, 'Active assignments'],
      [CalendarCheck, "Today's sessions", stats?.todaySessions ?? 0, 'Across your members'],
    ] :
    [
      [Users, 'Total members', stats?.totalMembers ?? 0, 'Registered member profiles'],
      [UserCheck, 'Active members', stats?.activeMembers ?? 0, 'Current membership status'],
      [CalendarCheck, "Today's check-ins", stats?.todayCheckins ?? 0, 'Attendance records'],
      [WalletCards, 'Monthly revenue', money(stats?.monthlyRevenue), 'Completed payments this month']
    ];

  return (
    <div className="dash-content">
      <div className={`welcome ${administrator ? 'admin-welcome' : ''}`}>
        <div>
          {administrator && <span className="admin-live"><i/> LIVE BUSINESS OVERVIEW</span>}
          <h2>{trainer ? 'Your members are moving.' : administrator ? `Welcome back, ${user?.name || 'Admin'}.` : `Good morning, ${user?.name || 'User'}.`}</h2>
          <p>{trainer ? 'Here is what your coaching day looks like.' : administrator ? 'Monitor performance, revenue and daily operations from one place.' : 'Here\'s the pulse of your gym today.'}</p>
        </div>
        {administrator ? <div className="admin-quick-actions">
          <button className="lime-btn" onClick={() => onNavigate('/register')}><Plus/> Register member</button>
          <button className="outline-btn" onClick={() => onNavigate('/admin/reports')}><ChartNoAxesCombined/> Reports</button>
        </div> : staffWorkspace && <button className="outline-btn" onClick={() => onNavigate(`/${role}/members`)}>View members</button>}
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
      {administrator && <AdminAnalytics stats={stats} onNavigate={onNavigate}/>} 
      {staffWorkspace && (membersError
        ? <div className="table-card management-message error-message" role="alert">{membersError}</div>
        : <MemberTable compact rows={members} onViewAll={() => onNavigate(`/${role}/members`)} />)}
    </div>
  );
}

function AdminAnalytics({ stats, onNavigate }) {
  const attendanceMap = new Map((stats?.attendanceTrend || []).map(item => [item.date, item.checkIns]));
  const attendance = recentGymDates(7).map(date => ({ date, checkIns: Number(attendanceMap.get(date)) || 0 }));
  const revenueMap = new Map((stats?.revenueTrend || []).map(item => [`${item.year}-${item.month}`, item]));
  const revenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index));
    const item = revenueMap.get(`${date.getFullYear()}-${date.getMonth() + 1}`) || {};
    return { ...item, revenue: item.revenue || 0, payments: item.payments || 0, label: date.toLocaleDateString('en-IN', { month: 'short' }) };
  });
  const memberships = stats?.membershipDistribution || [];
  const slots = stats?.slotUtilization || [];
  const paymentMethods = stats?.paymentMethodDistribution || [];
  const paymentTotal = paymentMethods.reduce((sum, item) => sum + item.value, 0);
  const tooltipStyle = { background: '#171a17', border: '1px solid #343a31', borderRadius: 8, color: '#f7f8f4' };
  return <>
    <section className="analytics-summary">
      <article><span>Currently inside</span><strong>{stats.currentlyCheckedIn || 0}</strong><small>Members checked in now</small></article>
      <article><span>Active trainers</span><strong>{stats.activeTrainers || 0}<em> / {stats.totalTrainers || 0}</em></strong><small>Available trainer profiles</small></article>
      <article><span>Expiring soon</span><strong>{stats.expiringSoon || 0}</strong><small>Within the next 30 days</small></article>
      <article><span>Pending dues</span><strong>{money(stats.pendingDues)}</strong><small>Outstanding member balance</small></article>
    </section>
    <section className="analytics-grid">
      <article className="analytics-card analytics-wide">
        <ChartTitle eyebrow="ATTENDANCE" title="Check-ins over the last 7 days"/>
        <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><AreaChart data={attendance} margin={{ left: -20, right: 8, top: 10 }}>
          <defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9ff18" stopOpacity={0.34}/><stop offset="100%" stopColor="#c9ff18" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="#252a23" vertical={false}/><XAxis dataKey="date" tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="checkIns" stroke="#c9ff18" strokeWidth={3} fill="url(#attendanceFill)"/>
        </AreaChart></ResponsiveContainer></div>
      </article>
      <article className="analytics-card">
        <ChartTitle eyebrow="MEMBERSHIPS" title="Status distribution"/>
        <div className="donut-layout"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={memberships} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{memberships.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle}/></PieChart></ResponsiveContainer><strong>{memberships.reduce((sum, item) => sum + item.value, 0)}<small>Total</small></strong></div><ChartLegend data={memberships}/></div>
      </article>
      <article className="analytics-card analytics-wide">
        <ChartTitle eyebrow="REVENUE" title="Completed payments over 6 months" value={money(revenue.reduce((sum, item) => sum + item.revenue, 0))}/>
        <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenue} margin={{ left: 4, right: 8, top: 10 }}><CartesianGrid stroke="#252a23" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis tickFormatter={value => `₹${Math.round(value / 1000)}k`} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={value => money(value)}/><Bar dataKey="revenue" fill="#c9ff18" radius={[6, 6, 0, 0]} maxBarSize={42}/></BarChart></ResponsiveContainer></div>
      </article>
      <article className="analytics-card">
        <ChartTitle eyebrow="CAPACITY" title="Daily slot utilization"/>
        <div className="slot-bars">{slots.length ? slots.map(slot => <div key={`${slot.name}-${slot.time}`}><p><span>{slot.name}<small>{slot.time}</small></span><b>{slot.members}/{slot.capacity}</b></p><div><i style={{ width: `${Math.min(slot.utilization, 100)}%` }}/></div></div>) : <p className="chart-empty">No slot data available.</p>}</div>
      </article>
    </section>
    <section className="analytics-lower-grid">
      <article className="analytics-card payment-mix-card">
        <ChartTitle eyebrow="PAYMENT MIX" title="Revenue by payment channel" value={money(paymentTotal)}/>
        <div className="payment-mix">{paymentMethods.length ? paymentMethods.map((method, index) => <div key={method.name}>
          <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/>
          <span><b>{method.name.replaceAll('_', ' ')}</b><small>{method.payments} payment{method.payments === 1 ? '' : 's'}</small></span>
          <strong>{money(method.value)}</strong>
          <em>{paymentTotal ? Math.round(method.value / paymentTotal * 100) : 0}%</em>
        </div>) : <p className="chart-empty">Completed payments will appear here.</p>}</div>
      </article>
      <article className="analytics-card admin-actions-card">
        <ChartTitle eyebrow="QUICK MANAGEMENT" title="Common admin actions"/>
        <div className="admin-action-grid">
          <button onClick={() => onNavigate('/admin/members')}><Users/><span><b>Members</b><small>Profiles and status</small></span><ChevronRight/></button>
          <button onClick={() => onNavigate('/admin/attendance')}><CalendarCheck/><span><b>Attendance</b><small>Check-ins and history</small></span><ChevronRight/></button>
          <button onClick={() => onNavigate('/admin/payments')}><WalletCards/><span><b>Payments</b><small>Revenue and receipts</small></span><ChevronRight/></button>
          <button onClick={() => onNavigate('/admin/memberships')}><CreditCard/><span><b>Memberships</b><small>Plans and renewals</small></span><ChevronRight/></button>
        </div>
      </article>
    </section>
  </>;
}

function ChartTitle({ eyebrow, title, value }) {
  return <div className="analytics-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{value && <strong>{value}</strong>}</div>;
}

function ChartLegend({ data }) {
  return <div className="chart-legend">{data.map((item, index) => <p key={item.name}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/><span>{item.name.replaceAll('_', ' ')}</span><b>{item.value}</b></p>)}</div>;
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
          <p>Your membership and attendance information from Vino Fitness Studio.</p>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0 }}>TODAY'S ATTENDANCE</p>
            {attendance?.sessionName && (
              <span className={`session-badge ${attendance.sessionName}`}>
                {attendance.sessionName}
              </span>
            )}
          </div>
          <h2>
            {stats?.todaySpending?.totalMinutes > 0
              ? `${stats.todaySpending.totalHoursFormatted} gym time today`
              : attendance ? 'Attendance recorded' : 'No attendance record'}
          </h2>
          <span><Clock3 /> {attendance?.checkInTime
            ? `Checked in at ${new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No check-in today'}</span>
          <span><Flame /> {attendance?.checkOutTime
            ? `Latest session: ${attendance.duration >= 60 ? `${Math.floor(attendance.duration/60)}h ${attendance.duration%60}m` : `${attendance.duration}m`}`
            : attendance?.checkInTime ? 'Currently active in gym' : 'Attendance tracked at biometric scanner'}</span>
          {stats?.todaySpending?.breakdown && stats.todaySpending.totalMinutes > 0 && (
            <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block', fontSize: '11px' }}>
              Morning: {stats.todaySpending.breakdown.morningFormatted} · Afternoon: {stats.todaySpending.breakdown.afternoonFormatted} · Evening: {stats.todaySpending.breakdown.eveningFormatted}
            </small>
          )}
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
