import { Fragment, useEffect, useState } from 'react';
import { api } from '../services';
import { CalendarDays, Loader2, Plus, RefreshCw, Download } from 'lucide-react';
import { openRazorpayCheckout } from '../services/razorpay';
import PaymentReceipt from '../components/PaymentReceipt';
import MemberProfileModal from '../components/MemberProfileModal';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const field = (name, label, type = 'text', options) => ({ name, label, type, options });
const member = field('memberId', 'Member', 'members');
const trainer = field('trainerId', 'Trainer', 'trainers');
const plan = field('planId', 'Membership plan', 'plans');
const slot = field('slotId', 'Daily gym time', 'slots');
const day = field('dayOfWeek', 'Day', 'select', days);
const times = [field('startTime', 'Start time', 'time'), field('endTime', 'End time', 'time')];
const person = [field('fullName', 'Full name'), field('mobileNumber', 'Mobile number', 'tel')];
const profileFields = [...person, field('address', 'Address'), field('emergencyContactName', 'Emergency contact'), field('emergencyContactPhone', 'Emergency phone', 'tel'), field('height', 'Height (cm)', 'number'), field('weight', 'Weight (kg)', 'number')];
const modules = {
  members: { url: '/members', key: 'members', columns: ['fullName', 'memberId', 'mobileNumber', 'registrationStatus', 'membershipStatus'], edit: profileFields },
  trainers: { url: '/trainers', key: 'trainers', columns: ['fullName', 'trainerId', 'gender', 'specialization', 'experience', 'convenientTimings', 'status'],
    create: [...person, field('gender', 'Gender', 'select', ['male', 'female', 'other']), field('email', 'Email', 'email'), field('password', 'Initial password (8–72 characters)', 'password'), field('specialization', 'Specialization'), field('experience', 'Experience in years', 'number'), field('workingDays', 'Working days', 'days'), field('convenientTimings', 'Convenient timings', 'checks', ['morning', 'afternoon', 'evening'])],
    edit: [...person, field('gender', 'Gender', 'select', ['male', 'female', 'other']), field('specialization', 'Specialization'), field('experience', 'Experience in years', 'number'), field('workingDays', 'Working days', 'days'), field('convenientTimings', 'Convenient timings', 'checks', ['morning', 'afternoon', 'evening'])] },
  plans: { url: '/membership-plans', columns: ['name', 'duration', 'price', 'status'],
    create: [field('name', 'Plan name'), field('description', 'Description'), field('duration', 'Duration in months', 'number'), field('price', 'Price (INR)', 'number'), field('facilities', 'Included services (comma separated)', 'list')],
    edit: [field('name', 'Plan name'), field('description', 'Description'), field('duration', 'Duration in months', 'number'), field('price', 'Price (INR)', 'number'), field('facilities', 'Included services (comma separated)', 'list'), field('status', 'Status', 'select', ['active', 'inactive'])] },
  memberships: { url: '/memberships', columns: ['member', 'membershipPlan', 'startDate', 'endDate', 'pendingAmount', 'status', 'paymentStatus'], create: [member, plan, slot] },
  membership: { url: '/memberships', columns: ['membershipPlan', 'startDate', 'endDate', 'pendingAmount', 'status', 'paymentStatus'] },
  attendance: { url: '/attendance', columns: ['member', 'checkInTime', 'checkOutTime', 'duration', 'attendanceStatus', 'deviceId'] },
  payments: { url: '/payments', columns: ['member', 'transactionId', 'amount', 'paymentMethod', 'paymentStatus', 'paymentDate'] },
  allocations: { url: '/trainer-allocations', columns: ['member', 'trainer', 'startDate', 'endDate', 'status'], create: [member, trainer, field('notes', 'Notes', 'optional')] },
  slotAllocations: { url: '/time-slots/allocations', columns: ['member', 'timeSlot', 'startDate', 'endDate', 'status'] },
  slots: { url: '/time-slots', columns: ['name', 'startTime', 'endTime', 'currentCapacity', 'maxCapacity', 'status'],
    create: [field('name', 'Slot name'), ...times, field('maxCapacity', 'Maximum members', 'number')],
    edit: [field('name', 'Slot name'), ...times, field('maxCapacity', 'Maximum members', 'number'), field('status', 'Status', 'select', ['active', 'inactive'])] },
  hours: { url: '/gym-timings', columns: ['dayOfWeek', 'isOpen', 'openTime', 'closeTime'],
    create: [day, field('isOpen', 'Open this day', 'checkbox'), field('openTime', 'Opening time', 'time'), field('closeTime', 'Closing time', 'time'), field('sessions', 'Open sessions', 'sessions')],
    edit: [day, field('isOpen', 'Open this day', 'checkbox'), field('openTime', 'Opening time', 'time'), field('closeTime', 'Closing time', 'time'), field('sessions', 'Open sessions', 'sessions')] },
  availability: { url: '/trainer-availabilities', columns: ['trainer', 'dayOfWeek', 'startTime', 'endTime', 'breakStartTime', 'breakEndTime', 'maxClients', 'isActive'],
    create: [trainer, day, ...times, field('maxClients', 'Maximum clients', 'number'), { ...field('breakStartTime', 'Break start', 'time'), optional: true }, { ...field('breakEndTime', 'Break end', 'time'), optional: true }],
    edit: [day, ...times, field('maxClients', 'Maximum clients', 'number'), { ...field('breakStartTime', 'Break start', 'time'), optional: true }, { ...field('breakEndTime', 'Break end', 'time'), optional: true }, field('isActive', 'Available', 'checkbox')] },
  notifications: { url: '/notifications', columns: ['title', 'message', 'isRead', 'createdAt'] },
  settings: { url: '/settings', key: 'settings', columns: ['key', 'value', 'category', 'description'] },
  users: { url: '/users', key: 'users', columns: ['email', 'role', 'isActive', 'lastLogin'], create: [field('email', 'Email', 'email'), field('password', 'Initial password (12?72 characters)', 'password'), field('role', 'Role', 'select', ['admin', 'reception'])] },
  audit: { url: '/audit-logs', key: 'logs', columns: ['user', 'action', 'entityType', 'timestamp'] },
  coach: { url: '/trainer-allocations', columns: ['trainer', 'startDate', 'status'] },
  schedule: { url: '/time-slots', columns: ['timeSlot', 'startDate', 'endDate', 'status'] },
  profile: { url: '/members/profile', columns: ['fullName', 'memberId', 'mobileNumber', 'height', 'weight', 'fitnessGoal'], edit: profileFields },
};
const reportTypes = ['registrations', 'memberships', 'attendance', 'revenue', 'pending-dues', 'expiring-memberships', 'trainer-allocations', 'trainer-performance', 'slot-utilization'];
const reportLabels = {
  registrations: 'Member registrations', memberships: 'Memberships', attendance: 'Attendance', revenue: 'Revenue and payments',
  'pending-dues': 'Pending dues', 'expiring-memberships': 'Expiring memberships', 'trainer-allocations': 'Trainer assignments',
  'trainer-performance': 'Trainer performance', 'slot-utilization': 'Time-slot utilization',
};
const reportColumns = {
  registrations: ['memberId', 'fullName', 'mobileNumber', 'fitnessGoal', 'registrationStatus', 'createdAt'],
  memberships: ['member', 'membershipPlan', 'startDate', 'endDate', 'totalAmount', 'paymentStatus', 'status'],
  attendance: ['member', 'attendanceDate', 'checkInTime', 'checkOutTime', 'duration', 'attendanceStatus'],
  revenue: ['member', 'transactionId', 'amount', 'paymentMethod', 'paymentDate'],
  'pending-dues': ['member', 'membershipPlan', 'pendingAmount', 'paymentStatus', 'endDate'],
  'expiring-memberships': ['member', 'membershipPlan', 'endDate', 'paymentStatus', 'status'],
  'trainer-allocations': ['member', 'trainer', 'startDate', 'endDate', 'status'],
  'trainer-performance': ['trainerName', 'specialization', 'experience', 'activeClients', 'totalClients', 'status'],
  'slot-utilization': ['name', 'startTime', 'endTime', 'currentAllocations', 'maxCapacity', 'utilizationPercentage'],
};
const trainerSectionTitles = {
  fullName: ['Personal details', 'Basic identity and contact information'],
  email: ['Account access', 'Login credentials for the trainer portal'],
  specialization: ['Professional details', 'Coaching expertise and experience'],
  workingDays: ['Schedule preferences', 'Select all suitable working days and time periods'],
};
const sectionHelp = {
  members: ['Member profiles', 'Find contact, health and account details for every registered member.', ['Register member', 'Open profile', 'Update details']],
  trainers: ['Trainer profiles', 'Manage trainer details and whether each trainer is available for work.', ['Add trainer', 'Update profile', 'Manage leave']],
  plans: ['Membership plans', 'Define the plans members can buy, including duration, price and facilities.', ['Create plan', 'Set price', 'Activate or deactivate']],
  memberships: ['Member memberships', 'See which plan each member owns, its dates, payment balance and current status.', ['Choose member', 'Assign plan', 'Renew or change']],
  membership: ['My membership', 'View your plan dates, payment balance and current membership status.', ['Review plan', 'Pay balance', 'View status']],
  attendance: ['Check-in and attendance', 'Record when a member enters or leaves. The member must have an active paid membership and use their assigned time slot.', ['Select member', 'Check in', 'Check out']],
  payments: ['Payments and receipts', 'Review money received, payment status and printable receipts.', ['Find payment', 'Check status', 'Open receipt']],
  allocations: ['Member trainer assignments', 'Connect each member with the trainer responsible for them.', ['Select member', 'Assign trainer', 'Reassign when needed']],
  slotAllocations: ['Member slot assignments', 'See or change the weekly gym time reserved for each member.', ['Select member', 'Choose time slot', 'Change assignment']],
  slots: ['Daily time slots', 'Create each gym time window once. A member assigned to it may attend during that same time on every open day.', ['Create time window', 'Set capacity', 'Allocate member']],
  hours: ['Gym opening hours', 'Set when the gym opens and closes on each weekday.', ['Choose weekday', 'Set hours', 'Save sessions']],
  availability: ['Trainer availability', 'Set the days and times when each trainer can accept members.', ['Choose trainer', 'Set working time', 'Add break']],
  notifications: ['Notifications', 'Read operational messages and send reminders to members when permitted.', ['Review message', 'Take action', 'Mark as read']],
  settings: ['System settings', 'Control supported gym rules and application options.', ['Find setting', 'Edit value', 'Save']],
  users: ['Staff accounts', 'Create and manage login access for administrators and reception staff.', ['Create account', 'Choose role', 'Activate or deactivate']],
  audit: ['Audit trail', 'Review important changes and the staff account that performed each action.', ['Find action', 'Review user', 'Check time']],
  reports: ['Reports', 'Review gym activity, revenue, memberships and utilization for a selected period.', ['Choose report', 'Set dates', 'Export']],
  profile: ['My profile', 'Review and update your personal and health details.', ['Review details', 'Edit', 'Save']],
  coach: ['My trainer', 'View your currently assigned trainer.', ['View trainer', 'Check status']],
  schedule: ['My weekly slot', 'View the gym time currently reserved for you.', ['Check weekday', 'Check time']],
};
const label = value => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
const friendlyError = message => message === 'Check-in is outside the active allocated time slot'
  ? 'Check-in blocked. This member can enter only during their assigned gym time. Open Member slot assignments to review or change it.'
  : message;
const displayClock = value => value ? new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const choiceText = (option, type) => {
  if (type === 'slots') return `${option.name} · ${displayClock(option.startTime)} – ${displayClock(option.endTime)}`;
  return `${option.fullName || option.name || option.member?.fullName || option._id}${option.membershipPlan?.name ? ` · ${option.membershipPlan.name}` : ''}${option.pendingAmount != null ? ` · INR ${option.pendingAmount} due` : ''}`;
};
const valueText = (value, key = '') => {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(v => valueText(v)).join(', ');
  if (typeof value === 'object') return value.fullName || value.name || value.email || value.memberId || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (/amount|revenue|totalValue/i.test(key) && Number.isFinite(Number(value))) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
  if (key === 'duration' && Number.isFinite(Number(value))) return `${value} min`;
  if (/Percentage$/i.test(key) && Number.isFinite(Number(value))) return `${value}%`;
  if (['dateOfBirth', 'startDate', 'endDate', 'attendanceDate', 'createdAt', 'paymentDate'].includes(key) && /^\d{4}-\d{2}-\d{2}T/.test(String(value))) return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (/Date$|Time$|At$|timestamp/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(String(value))) return new Date(value).toLocaleString();
  return String(value);
};
const summaryItems = summary => Object.entries(summary || {}).flatMap(([key, value]) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).map(([child, count]) => ({ key: `${key}-${child}`, label: child, value: count }))
    : [{ key, label: key, value }]
).filter(item => item.value !== undefined).slice(0, 8);
const unpack = (data, key) => Array.isArray(data) ? data : key && Array.isArray(data?.[key]) ? data[key] : data?._id ? [data] : [];
const csvCell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';

export default function Operations({ section, user, query = '' }) {
  const isAdmin = user.role === 'admin';
  const staff = ['admin', 'reception'].includes(user.role);
  const definition = modules[section];
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState(null);
  const [values, setValues] = useState({});
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState('registrations');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [details, setDetails] = useState(null);
  const [memberSlot, setMemberSlot] = useState(undefined);
  const [slotLoading, setSlotLoading] = useState(false);
  useEffect(() => { setPage(1); setRows([]); setAction(null); setReceipt(null); setDetails(null); }, [section, query]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        let url = definition?.url;
        if (section === 'reports') url = `/reports/${report}`;
        if (user.role === 'trainer' && section === 'members') url = `/trainer-allocations/trainer/${user.profile?._id}`;
        if (user.role === 'trainer' && section === 'availability') url = `/trainer-availabilities/trainer/${user.profile?._id}`;
        if (user.role === 'member' && section === 'membership') url = `/memberships/history/${user.profile?._id}`;
        if (user.role === 'member' && ['payments', 'attendance'].includes(section)) url = `/${section}/member/${user.profile?._id}`;
        if (section === 'coach') url = `/trainer-allocations/member/${user.profile?._id}`;
        if (section === 'schedule') url = `/time-slots/member/${user.profile?._id}`;
        if (!url) { setRows([]); return; }
        const response = await api.get(url, { params: { page, limit: 25, search: query || undefined, startDate: startDate || undefined, endDate: endDate || undefined } });
        if (!active) return;
        const data = response.data.data;
        let list = unpack(data, definition?.key);
        if (section === 'reports') {
          list = Array.isArray(data) ? data : Object.values(data).find(Array.isArray) || [];
          setSummary(data.summary || null);
        }
        setRows(list); setPagination(data?.pagination || null);
      } catch (err) { if (active) setError(err.response?.data?.error || 'Could not load records'); }
      finally { if (active) setLoading(false); }
    };
    load(); return () => { active = false; };
  }, [section, user, query, page, revision, report, startDate, endDate]);

  const begin = async (title, method, url, fields = [], row = {}, defaults = {}) => {
    setError(''); setNotice(''); setBusy(true);
    setMemberSlot(undefined); setSlotLoading(false);
    const initial = { ...row, ...defaults };
    for (const f of fields) {
      if (f.type === 'list' && Array.isArray(initial[f.name])) initial[f.name] = initial[f.name].join(', ');
      if (f.type === 'checkbox' && initial[f.name] === undefined) initial[f.name] = false;
      if (f.type === 'checks' && !Array.isArray(initial[f.name])) initial[f.name] = [];
    }
    setValues(initial);
    setAction({ title, method, url, fields, key: crypto.randomUUID() });
    const needed = [...new Set(fields.map(f => f.type).filter(type => ['members', 'trainers', 'plans', 'slots', 'memberships'].includes(type)))];
    try {
      const entries = await Promise.all(needed.map(async type => {
        const response = await api.get({ members: '/members', trainers: '/trainers', plans: '/membership-plans', slots: '/time-slots', memberships: '/memberships' }[type], { params: { limit: 100, dayOfWeek: type === 'slots' ? 'monday' : undefined } });
        let items = unpack(response.data.data, type);
        if (type === 'slots') {
          const seen = new Set();
          items = items.filter(item => {
            const key = `${item.name}|${item.startTime}|${item.endTime}`;
            if (seen.has(key)) return false;
            seen.add(key); return true;
          });
        }
        return [type, items];
      }));
      setChoices(Object.fromEntries(entries));
    } catch (err) { setError(err.response?.data?.error || 'Unable to load form options'); } finally { setBusy(false); }
  };
  const changeField = async (formField, value) => {
    setValues(current => ({ ...current, [formField.name]: value }));
    if (formField.name !== 'memberId' || !action?.url?.startsWith('/attendance/manual-')) return;
    if (!value) { setMemberSlot(undefined); return; }
    setSlotLoading(true); setMemberSlot(undefined);
    try {
      const response = await api.get(`/time-slots/member/${value}`);
      setMemberSlot(response.data.data?.[0] || null);
    } catch {
      setMemberSlot(null);
    } finally { setSlotLoading(false); }
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = {};
      for (const f of action.fields) {
        const v = values[f.name];
        body[f.name] = f.type === 'number' ? Number(v) : f.type === 'list' ? v.split(',').map(s => s.trim()).filter(Boolean) : f.type === 'checkbox' ? Boolean(v) : v;
      }
      if (section === 'hours') body.sessions = (values.sessions || []).map(({ name, startTime, endTime }) => ({ name, startTime, endTime }));
      if (section === 'slots' && action.method === 'post') body.dayOfWeek = 'monday';
      for (const key of ['breakStartTime', 'breakEndTime']) if (body[key] === '') delete body[key];
      if (action.url.includes('/correct')) {
        if (body.checkInTime) body.checkInTime = new Date(body.checkInTime).toISOString();
        if (body.checkOutTime) body.checkOutTime = new Date(body.checkOutTime).toISOString();
        else body.checkOutTime = null;
      }
      if (action.url === '/payments') { body.paymentMethod = 'cash'; body.cashReceived = Boolean(values.cashReceived); }
      const result = await api.request({ method: action.method, url: action.url, data: body, headers: { 'Idempotency-Key': action.key } });
      setAction(null); setNotice(result.data.message || 'Saved successfully.'); setRevision(v => v + 1);
    } catch (err) { setError(friendlyError(err.response?.data?.error || 'Unable to save. Your changes have not been confirmed.')); }
    finally { setBusy(false); }
  };
  const payOnline = async row => {
    setBusy(true); setError('');
    try {
      const response = await api.post('/payments/razorpay/checkout', { membershipId: row._id });
      if (response.data.data.completed) { setRevision(value => value + 1); return; }
      const payment = await openRazorpayCheckout(response.data.data);
      await api.post('/payments/razorpay/verify', { membershipId: row._id, ...payment });
      setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.error || err.message || 'Unable to complete Razorpay payment'); }
    finally { setBusy(false); }
  };
  const openReceipt = async row => {
    setBusy(true); setError('');
    try {
      const response = await api.get(`/payments/${row._id}`);
      setReceipt(response.data.data);
    } catch (err) { setError(err.response?.data?.error || 'Unable to load the payment receipt'); }
    finally { setBusy(false); }
  };
  const openMemberProfile = async row => {
    const memberId = row.member?._id || row.member || row._id;
    setBusy(true); setError('');
    try {
      const response = await api.get(`/members/${memberId}`);
      setDetails(response.data.data);
    } catch (err) { setError(err.response?.data?.error || 'Unable to load the member profile'); }
    finally { setBusy(false); }
  };
  const exportRows = () => {
    const keys = columns;
    const csv = [keys.map(key => csvCell(label(key))).join(','), ...visible.map(row => keys.map(key => csvCell(valueText(row[key], key))).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `pulsefit-${section}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const visible = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  let columns = section === 'reports' ? reportColumns[report] || [] : definition?.columns || [];
  if (user.role === 'trainer' && section === 'members') columns = ['member', 'startDate', 'status'];
  const showActions = section !== 'reports';
  const createAllowed = staff && (isAdmin || ['memberships', 'allocations'].includes(section));
  const rowActions = row => {
    const buttons = [];
    const add = (title, method, url, fields, defaults) => buttons.push(<button className="outline-btn" disabled={busy} key={title} onClick={() => begin(title, method, url, fields, row, defaults)}>{title}</button>);
    const canEdit = (isAdmin && section !== 'profile') ||
      (user.role === 'reception' && section === 'slots') ||
      (section === 'profile' && user.role === 'member');
    if (definition?.edit && canEdit) add('Edit', 'put', section === 'profile' ? definition.url : `${definition.url}/${row._id}`, definition.edit);
    if (section === 'members') buttons.push(<button className="outline-btn" disabled={busy} key="details" onClick={() => openMemberProfile(row)}>View profile</button>);
    if (section === 'members' && isAdmin) add('Suspend', 'delete', `/members/${row._id}`, []);
    if (section === 'trainers' && isAdmin) {
      add(row.status === 'on_leave' ? 'Return from leave' : 'Place on leave', 'post', `/trainer-availabilities/${row.status === 'on_leave' ? 'reactivate' : 'leave'}/${row._id}`, row.status === 'on_leave' ? [] : [field('reason', 'Leave reason')]);
      add('Deactivate', 'delete', `/trainers/${row._id}`, []);
    }
    if (['memberships', 'membership'].includes(section)) {
      if (staff && row.pendingAmount > 0) {
        add('Record cash received', 'post', '/payments', [member, field('membershipId', 'Membership', 'memberships'), field('amount', 'Cash amount (INR)', 'number'), field('cashReceived', 'I confirm cash has been physically received', 'checkbox')], { memberId: row.member?._id || row.member, membershipId: row._id, amount: row.pendingAmount });
        add('Cancel online checkout', 'post', '/payments/razorpay/cancel', [field('membershipId', 'Membership', 'memberships')], { membershipId: row._id });
        if (row.status === 'pending') add('Change requested slot / trainer', 'patch', `/memberships/${row._id}/selection`, [slot, field('trainerId', 'Trainer (leave blank for none)', 'trainers', true)]);
      }
      if (user.role === 'member' && row.pendingAmount > 0) buttons.push(<button className="lime-btn" disabled={busy} key="razorpay" onClick={() => payOnline(row)}>Pay with Razorpay</button>);
      if (staff && row.status !== 'pending') {
        add('Renew', 'post', `/memberships/${row._id}/renew`, [plan, slot]);
        if (row.status === 'active') add('Change plan', 'post', `/memberships/${row._id}/change`, [plan, field('action', 'Change', 'select', ['upgrade'])]);
        if (isAdmin) {
          if (['active', 'frozen'].includes(row.status)) add(row.status === 'frozen' ? 'Unfreeze' : 'Freeze', 'post', `/memberships/${row._id}/${row.status === 'frozen' ? 'unfreeze' : 'freeze'}`, []);
          if (row.status !== 'cancelled') add('Cancel membership', 'post', `/memberships/${row._id}/cancel`, []);
        }
      }
    }
    if (section === 'attendance' && isAdmin) add('Correct times', 'put', `/attendance/${row._id}/correct`, [field('checkInTime', 'Check-in', 'datetime-local'), { ...field('checkOutTime', 'Check-out', 'datetime-local'), optional: true }, field('correctionReason', 'Correction reason')], {
      checkInTime: localInput(row.checkInTime), checkOutTime: localInput(row.checkOutTime),
    });
    if (section === 'payments') {
      if (row.paymentStatus === 'completed' || row.paymentStatus === 'refunded') buttons.push(<button className="outline-btn" key="receipt" disabled={busy} onClick={() => openReceipt(row)}>Receipt</button>);
      if (isAdmin && row.paymentStatus === 'completed' && row.paymentMethod === 'online_gateway') add('Refund online', 'post', `/payments/${row._id}/refund`, [field('reason', 'Refund reason')]);
      if (isAdmin && row.paymentStatus === 'completed' && row.paymentMethod === 'cash') add('Refund cash', 'post', `/payments/${row._id}/refund`, [field('reason', 'Refund reason'), field('cashRefunded', 'I confirm cash has been returned', 'checkbox')]);
    }
    if (section === 'allocations' && staff && row.status === 'active') {
      add('Reassign', 'put', `/trainer-allocations/${row._id}/reassign`, [field('newTrainerId', 'New trainer', 'trainers')]);
      if (isAdmin) add('Remove assignment', 'delete', `/trainer-allocations/${row._id}`, []);
    }
    if (section === 'slotAllocations' && staff && row.status === 'active') {
      add('Change time', 'put', `/time-slots/change/${row._id}`, [field('newSlotId', 'New daily time', 'slots')]);
      if (isAdmin) add('Cancel slot allocation', 'delete', `/time-slots/allocate/${row._id}`, []);
    }
    if (section === 'notifications' && !row.isRead) add('Mark read', 'put', `/notifications/${row._id}/read`, []);
    if (section === 'settings' && isAdmin && row.isEditable) add('Edit setting', 'put', `/settings/${row.key}`, [field('value', row.description || label(row.key), typeof row.value === 'boolean' ? 'checkbox' : typeof row.value === 'number' ? 'number' : 'text')]);
    if (section === 'users' && isAdmin) add(row.isActive ? 'Deactivate' : 'Reactivate', 'patch', `/users/${row._id}/status`, [field('isActive', 'Account active', 'checkbox')], { isActive: !row.isActive });
    if (section === 'slots' && staff) add('Allocate member', 'post', '/time-slots/allocate', [member, field('membershipId', 'Membership', 'memberships'), slot], { slotId: row._id });
    return buttons;
  };
  const paymentMetrics = section === 'payments' ? {
    collected: visible.filter(row => row.paymentStatus === 'completed').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    online: visible.filter(row => row.paymentStatus === 'completed' && row.paymentMethod === 'online_gateway').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    cash: visible.filter(row => row.paymentStatus === 'completed' && row.paymentMethod === 'cash').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    refunded: visible.filter(row => row.paymentStatus === 'refunded').reduce((sum, row) => sum + Number(row.amount || 0), 0),
  } : null;
  const renderCell = (row, key) => {
    const value = row[key];
    if (section === 'payments' && key === 'member') {
      const name = value?.fullName || 'Unknown member';
      return <div className="payment-member"><i>{name.split(' ').map(part => part[0]).join('').slice(0, 2)}</i><span><b>{name}</b><small>{value?.memberId || 'Member'}</small></span></div>;
    }
    if (section === 'payments' && key === 'transactionId') return <code className="transaction-reference" title={value}>{value}</code>;
    if (section === 'payments' && key === 'amount') return <strong className="payment-amount">{valueText(value, key)}</strong>;
    if (section === 'payments' && key === 'paymentMethod') return <span className={`payment-method ${value}`}>{value === 'online_gateway' ? 'Razorpay' : label(value || 'unknown')}</span>;
    if (['status', 'paymentStatus', 'registrationStatus', 'attendanceStatus'].includes(key)) return <span className={`status ${String(value || '').toLowerCase()}`}>{label(String(value || 'unknown'))}</span>;
    return valueText(value, key);
  };
  const help = sectionHelp[section];
  const trainerForm = action?.url?.startsWith('/trainers');
  const calendarOnly = event => {
    event.preventDefault();
    event.currentTarget.showPicker?.();
  };
  return <div className="dash-content operations">
    {help && <section className="section-guide" aria-label={`${help[0]} purpose`}>
      <div><span>Purpose</span><h2>{help[0]}</h2><p>{help[1]}</p></div>
      <ol>{help[2].map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol>
    </section>}
    <div className="toolbar operation-tools">
      {section === 'reports' && <label className="report-type-filter"><span>Report</span><select value={report} onChange={e => setReport(e.target.value)}>{reportTypes.map(type => <option key={type} value={type}>{reportLabels[type]}</option>)}</select></label>}
      {['reports', 'attendance', 'payments'].includes(section) && <>
        <label className="date-filter calendar-only-filter"><span>From</span><input aria-label="From date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} onKeyDown={event => event.preventDefault()} onPaste={event => event.preventDefault()} onClick={calendarOnly}/><CalendarDays/></label>
        <label className="date-filter calendar-only-filter"><span>To</span><input aria-label="To date" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} onKeyDown={event => event.preventDefault()} onPaste={event => event.preventDefault()} onClick={calendarOnly}/><CalendarDays/></label>
      </>}
      <button className="outline-btn" onClick={() => setRevision(v => v + 1)}><RefreshCw size={16}/> Reload</button>
      <button className="outline-btn" disabled={!visible.length} onClick={exportRows}><Download size={16}/> Download CSV</button>
      {definition?.create && createAllowed && <button className="lime-btn" onClick={() => begin('Create ' + label(section), 'post', definition.url, definition.create)}><Plus size={16}/> Create</button>}
      {section === 'attendance' && staff && <>
        <button className="lime-btn" onClick={() => begin('Manual check-in', 'post', '/attendance/manual-checkin', [member, field('notes', 'Entry reason')])}>Check in member</button>
        <button className="outline-btn" onClick={() => begin('Manual check-out', 'post', '/attendance/manual-checkout', [member, field('notes', 'Exit reason')])}>Check out member</button>
      </>}
      {section === 'notifications' && isAdmin && <>
        <button className="outline-btn" onClick={() => begin('Send in-app expiry reminders', 'post', '/notifications/membership-expiry-reminder')}>Send expiry reminders</button>
        <button className="outline-btn" onClick={() => begin('Send in-app payment reminders', 'post', '/notifications/payment-due-reminder')}>Send due reminders</button>
      </>}
      {section === 'settings' && isAdmin && <button className="lime-btn" onClick={() => begin('Initialize missing default settings', 'post', '/settings/initialize')}>Initialize defaults</button>}
    </div>
    {section === 'slots' && <p>Each time slot applies every day the gym is open. Members select it once during registration.</p>}
    {error && <div className="error-message management-message" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    {paymentMetrics && <section className="payment-summary-grid">
      <article><span>Total collected</span><strong>{valueText(paymentMetrics.collected, 'amount')}</strong><small>{visible.length} transactions shown</small></article>
      <article><span>Razorpay</span><strong>{valueText(paymentMetrics.online, 'amount')}</strong><small>Completed online payments</small></article>
      <article><span>Cash</span><strong>{valueText(paymentMetrics.cash, 'amount')}</strong><small>Completed counter payments</small></article>
      <article><span>Refunded</span><strong>{valueText(paymentMetrics.refunded, 'amount')}</strong><small>Refunded transaction value</small></article>
    </section>}
    {summary && section === 'reports' && <section className="report-summary">{summaryItems(summary).map(item => <article key={item.key}><span>{label(item.label)}</span><strong>{valueText(item.value, item.key)}</strong></article>)}</section>}
    {action && <div className="operation-modal" role="dialog" aria-modal="true" aria-label={action.title}>
      <form className={`registration-form operation-form ${trainerForm ? 'trainer-operation-form' : ''}`} onSubmit={submit}>
        <div className="operation-form-head"><div><span>{trainerForm ? 'TRAINER PROFILE' : 'MANAGEMENT ACTION'}</span><h2>{action.title}</h2></div>{trainerForm && <p>Complete the trainer’s profile, login access and preferred schedule.</p>}</div>
        {error && <p role="alert" className="error-message">{error}</p>}
        {!action.fields.length && <p>Confirm this action. It will be recorded against your account.</p>}
        <div className="form-grid">{action.fields.map(f => <Fragment key={f.name}>
          {trainerForm && trainerSectionTitles[f.name] && <div className="trainer-form-section"><h3>{trainerSectionTitles[f.name][0]}</h3><p>{trainerSectionTitles[f.name][1]}</p></div>}
          <label className={`operation-field field-${f.name} ${['days', 'checks'].includes(f.type) ? 'full-width' : ''}`}>{f.label}
          {f.type === 'sessions' ? <div className="session-inputs">
            {(values.sessions || []).map((session, index) => <div className="session-row" key={index}>
              {['name', 'startTime', 'endTime'].map(key => <input key={key} aria-label={`Session ${index + 1} ${label(key)}`} required type={key === 'name' ? 'text' : 'time'} value={session[key] || ''} onChange={e => setValues({ ...values, sessions: values.sessions.map((current, i) => i === index ? { ...current, [key]: e.target.value } : current) })}/>)}
              <button type="button" className="outline-btn" onClick={() => setValues({ ...values, sessions: values.sessions.filter((_, i) => i !== index) })}>Remove session</button>
            </div>)}
            <button type="button" className="outline-btn" onClick={() => setValues({ ...values, sessions: [...(values.sessions || []), { name: '', startTime: '', endTime: '' }] })}>Add session</button>
          </div> : f.type === 'select' || choices[f.type] ? <select required={f.options !== true} value={values[f.name] || ''} onChange={e => changeField(f, e.target.value)}>
            <option value="">Select {f.label}</option>{(choices[f.type] || f.options || []).map(option => typeof option === 'string' ? <option key={option} value={option}>{label(option)}</option> :
              <option key={option._id} value={option._id}>{choiceText(option, f.type)}</option>)}
          </select> : f.type === 'days' || f.type === 'checks' ? <div className="day-options">{(f.type === 'days' ? days : f.options).map(d => <label key={d}><input type="checkbox" checked={(values[f.name] || []).includes(d)} onChange={e => setValues({ ...values, [f.name]: e.target.checked ? [...(values[f.name] || []), d] : values[f.name].filter(x => x !== d) })}/>{label(d)}</label>)}</div> :
          <input type={['optional', 'list'].includes(f.type) || ['members','trainers','slots','plans','memberships'].includes(f.type) ? 'text' : f.type}
            required={!f.optional && !['optional','checkbox'].includes(f.type)} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined}
            minLength={f.type === 'password' ? section === 'users' ? 12 : 8 : undefined} maxLength={f.type === 'password' ? 72 : undefined}
            checked={f.type === 'checkbox' ? Boolean(values[f.name]) : undefined} value={f.type === 'checkbox' ? undefined : values[f.name] ?? ''}
            onChange={e => changeField(f, f.type === 'checkbox' ? e.target.checked : e.target.value)}/>}</label></Fragment>)}</div>
        {action.url.startsWith('/attendance/manual-') && values.memberId && <div className={`member-slot-preview ${memberSlot === null ? 'missing' : ''}`}>
          <span>Assigned gym time</span>
          {slotLoading ? <strong>Checking member slot…</strong> : memberSlot?.timeSlot
            ? <><strong>Daily · {displayClock(memberSlot.timeSlot.startTime)} – {displayClock(memberSlot.timeSlot.endTime)}</strong><small>{memberSlot.timeSlot.name}</small></>
            : <><strong>No active time slot assigned</strong><small>Assign a slot before checking this member in.</small></>}
        </div>}
        <div className="form-actions"><button type="button" className="outline-btn" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className="lime-btn" disabled={busy}>{busy ? 'Saving?' : 'Confirm'}</button></div>
      </form>
    </div>}
    {details && <MemberProfileModal member={details} onClose={() => setDetails(null)}/>}
    {receipt && <PaymentReceipt payment={receipt} onClose={() => setReceipt(null)}/>}
    {loading ? <p role="status"><Loader2 className="animate-spin"/> Loading…</p> : <section className={`table-card ${section === 'reports' ? 'report-table-card' : ''} ${section === 'payments' ? 'payments-table-card' : ''}`}><div className="table-scroll"><table>
      <thead><tr>{columns.map(key => <th key={key}>{label(key)}</th>)}{showActions && <th>Actions</th>}</tr></thead>
      <tbody>{visible.length ? visible.map((row, i) => <tr key={row._id || row.slotId || i}>{columns.map(key => <td key={key}>{renderCell(row, key)}</td>)}{showActions && <td><div className="row-actions">{rowActions(row)}</div></td>}</tr>) : <tr><td className="empty-table" colSpan={columns.length + (showActions ? 1 : 0)}>No records found for the selected filters.</td></tr>}</tbody>
    </table></div></section>}
    {pagination && <div className="form-actions"><button className="outline-btn" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><span>Page {page} of {pagination.pages || 1} ? {pagination.total} records</span><button className="outline-btn" disabled={page >= pagination.pages} onClick={() => setPage(v => v + 1)}>Next</button></div>}
  </div>;
}
function localInput(value) {
  if (!value) return '';
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
