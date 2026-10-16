import { useEffect, useState } from 'react';
import { api } from '../services';
import { Loader2, Plus, RefreshCw, Download } from 'lucide-react';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const field = (name, label, type = 'text', options) => ({ name, label, type, options });
const member = field('memberId', 'Member', 'members');
const trainer = field('trainerId', 'Trainer', 'trainers');
const plan = field('planId', 'Membership plan', 'plans');
const slot = field('slotId', 'Gym slot', 'slots');
const day = field('dayOfWeek', 'Day', 'select', days);
const times = [field('startTime', 'Start time', 'time'), field('endTime', 'End time', 'time')];
const person = [field('fullName', 'Full name'), field('mobileNumber', 'Mobile number', 'tel')];
const profileFields = [...person, field('address', 'Address'), field('emergencyContactName', 'Emergency contact'), field('emergencyContactPhone', 'Emergency phone', 'tel'), field('height', 'Height (cm)', 'number'), field('weight', 'Weight (kg)', 'number')];
const modules = {
  members: { url: '/members', key: 'members', columns: ['fullName', 'memberId', 'mobileNumber', 'registrationStatus', 'membershipStatus'], edit: profileFields },
  trainers: { url: '/trainers', key: 'trainers', columns: ['fullName', 'trainerId', 'specialization', 'experience', 'status'],
    create: [...person, field('email', 'Email', 'email'), field('password', 'Initial password (8?72 characters)', 'password'), field('specialization', 'Specialization'), field('experience', 'Experience in years', 'number'), field('workingDays', 'Working days', 'days')],
    edit: [...person, field('specialization', 'Specialization'), field('experience', 'Experience in years', 'number'), field('workingDays', 'Working days', 'days')] },
  plans: { url: '/membership-plans', columns: ['name', 'duration', 'price', 'status'],
    create: [field('name', 'Plan name'), field('description', 'Description'), field('duration', 'Duration in months', 'number'), field('price', 'Price (INR)', 'number'), field('facilities', 'Included services (comma separated)', 'list')],
    edit: [field('name', 'Plan name'), field('description', 'Description'), field('duration', 'Duration in months', 'number'), field('price', 'Price (INR)', 'number'), field('facilities', 'Included services (comma separated)', 'list'), field('status', 'Status', 'select', ['active', 'inactive'])] },
  memberships: { url: '/memberships', columns: ['member', 'membershipPlan', 'startDate', 'endDate', 'pendingAmount', 'status', 'paymentStatus'], create: [member, plan, slot] },
  membership: { url: '/memberships', columns: ['membershipPlan', 'startDate', 'endDate', 'pendingAmount', 'status', 'paymentStatus'] },
  attendance: { url: '/attendance', columns: ['member', 'checkInTime', 'checkOutTime', 'duration', 'attendanceStatus', 'deviceId'] },
  payments: { url: '/payments', columns: ['member', 'transactionId', 'amount', 'paymentMethod', 'paymentStatus', 'paymentDate'] },
  allocations: { url: '/trainer-allocations', columns: ['member', 'trainer', 'startDate', 'endDate', 'status'], create: [member, trainer, field('notes', 'Notes', 'optional')] },
  slotAllocations: { url: '/time-slots/allocations', columns: ['member', 'timeSlot', 'startDate', 'endDate', 'status'] },
  slots: { url: '/time-slots', columns: ['name', 'dayOfWeek', 'startTime', 'endTime', 'currentCapacity', 'maxCapacity', 'status'],
    create: [field('name', 'Slot name'), day, ...times, field('maxCapacity', 'Maximum members', 'number')],
    edit: [field('name', 'Slot name'), day, ...times, field('maxCapacity', 'Maximum members', 'number'), field('status', 'Status', 'select', ['active', 'inactive'])] },
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
  stripe: { url: '/payments/stripe/events', columns: ['sessionId', 'status', 'lastError', 'updatedAt'] },
  coach: { url: '/trainer-allocations', columns: ['trainer', 'startDate', 'status'] },
  schedule: { url: '/time-slots', columns: ['timeSlot', 'startDate', 'endDate', 'status'] },
  profile: { url: '/members/profile', columns: ['fullName', 'memberId', 'mobileNumber', 'height', 'weight', 'fitnessGoal'], edit: profileFields },
};
const reportTypes = ['registrations', 'memberships', 'attendance', 'revenue', 'pending-dues', 'expiring-memberships', 'trainer-allocations', 'trainer-performance', 'slot-utilization'];
const label = value => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
const valueText = (value, key = '') => {
  if (value == null || value === '') return '?';
  if (Array.isArray(value)) return value.map(v => valueText(v)).join(', ');
  if (typeof value === 'object') return value.fullName || value.name || value.email || value.memberId || '?';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (/Date$|Time$|At$|timestamp/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(String(value))) return new Date(value).toLocaleString();
  return String(value);
};
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
    const initial = { ...row, ...defaults };
    for (const f of fields) {
      if (f.type === 'list' && Array.isArray(initial[f.name])) initial[f.name] = initial[f.name].join(', ');
      if (f.type === 'checkbox' && initial[f.name] === undefined) initial[f.name] = false;
    }
    setValues(initial);
    setAction({ title, method, url, fields, key: crypto.randomUUID() });
    const needed = [...new Set(fields.map(f => f.type).filter(type => ['members', 'trainers', 'plans', 'slots', 'memberships'].includes(type)))];
    try {
      const entries = await Promise.all(needed.map(async type => {
        const response = await api.get({ members: '/members', trainers: '/trainers', plans: '/membership-plans', slots: '/time-slots', memberships: '/memberships' }[type], { params: { limit: 100 } });
        return [type, unpack(response.data.data, type)];
      }));
      setChoices(Object.fromEntries(entries));
    } catch (err) { setError(err.response?.data?.error || 'Unable to load form options'); } finally { setBusy(false); }
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
      for (const key of ['breakStartTime', 'breakEndTime']) if (body[key] === '') delete body[key];
      if (action.url.includes('/correct')) {
        if (body.checkInTime) body.checkInTime = new Date(body.checkInTime).toISOString();
        if (body.checkOutTime) body.checkOutTime = new Date(body.checkOutTime).toISOString();
        else body.checkOutTime = null;
      }
      if (action.url === '/payments') { body.paymentMethod = 'cash'; body.cashReceived = Boolean(values.cashReceived); }
      const result = await api.request({ method: action.method, url: action.url, data: body, headers: { 'Idempotency-Key': action.key } });
      setAction(null); setNotice(result.data.message || 'Saved successfully.'); setRevision(v => v + 1);
    } catch (err) { setError(err.response?.data?.error || 'Unable to save. Your changes have not been confirmed.'); }
    finally { setBusy(false); }
  };
  const payOnline = async row => {
    setBusy(true); setError('');
    try { const response = await api.post('/payments/stripe/checkout', { membershipId: row._id }); window.location.assign(response.data.data.url); }
    catch (err) { setError(err.response?.data?.error || 'Unable to open checkout'); setBusy(false); }
  };
  const exportRows = () => {
    const keys = columns;
    const csv = [keys.map(key => csvCell(label(key))).join(','), ...visible.map(row => keys.map(key => csvCell(valueText(row[key], key))).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `pulsefit-${section}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const visible = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  let columns = section === 'reports' ? Object.keys(rows[0] || {}).filter(k => k !== '_id' && k !== '__v' && !Array.isArray(rows[0]?.[k])) : definition?.columns || [];
  if (user.role === 'trainer' && section === 'members') columns = ['member', 'startDate', 'status'];
  const createAllowed = staff && (isAdmin || ['memberships', 'allocations'].includes(section));
  const rowActions = row => {
    const buttons = [];
    const add = (title, method, url, fields, defaults) => buttons.push(<button className="outline-btn" disabled={busy} key={title} onClick={() => begin(title, method, url, fields, row, defaults)}>{title}</button>);
    if (definition?.edit && ((isAdmin && section !== 'profile') || (section === 'profile' && user.role === 'member'))) add('Edit', 'put', section === 'profile' ? definition.url : `${definition.url}/${row._id}`, definition.edit);
    if (section === 'members') buttons.push(<button className="outline-btn" key="details" onClick={() => setDetails(row.member || row)}>View profile</button>);
    if (section === 'members' && isAdmin) add('Suspend', 'delete', `/members/${row._id}`, []);
    if (section === 'trainers' && isAdmin) {
      add(row.status === 'on_leave' ? 'Return from leave' : 'Place on leave', 'post', `/trainer-availabilities/${row.status === 'on_leave' ? 'reactivate' : 'leave'}/${row._id}`, row.status === 'on_leave' ? [] : [field('reason', 'Leave reason')]);
      add('Deactivate', 'delete', `/trainers/${row._id}`, []);
    }
    if (['memberships', 'membership'].includes(section)) {
      if (staff && row.pendingAmount > 0) {
        add('Record cash received', 'post', '/payments', [member, field('membershipId', 'Membership', 'memberships'), field('amount', 'Cash amount (INR)', 'number'), field('cashReceived', 'I confirm cash has been physically received', 'checkbox')], { memberId: row.member?._id || row.member, membershipId: row._id, amount: row.pendingAmount });
        add('Cancel online checkout', 'post', '/payments/stripe/cancel', [field('membershipId', 'Membership', 'memberships')], { membershipId: row._id });
        if (row.status === 'pending') add('Change requested slot / trainer', 'patch', `/memberships/${row._id}/selection`, [slot, field('trainerId', 'Trainer (leave blank for none)', 'trainers', true)]);
      }
      if (user.role === 'member' && row.pendingAmount > 0) buttons.push(<button className="lime-btn" disabled={busy} key="stripe" onClick={() => payOnline(row)}>Pay with Stripe</button>);
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
      if (row.paymentStatus === 'completed' || row.paymentStatus === 'refunded') buttons.push(<button className="outline-btn" key="receipt" onClick={() => setReceipt(row)}>View receipt</button>);
      if (isAdmin && row.paymentStatus === 'completed' && row.paymentMethod === 'online_gateway') add('Refund with Stripe', 'post', `/payments/${row._id}/refund`, [field('reason', 'Refund reason')]);
      if (isAdmin && row.paymentStatus === 'completed' && row.paymentMethod === 'cash') add('Record cash refund', 'post', `/payments/${row._id}/refund`, [field('reason', 'Refund reason'), field('cashRefunded', 'I confirm cash has been returned', 'checkbox')]);
    }
    if (section === 'allocations' && staff && row.status === 'active') {
      add('Reassign', 'put', `/trainer-allocations/${row._id}/reassign`, [field('newTrainerId', 'New trainer', 'trainers')]);
      if (isAdmin) add('Remove assignment', 'delete', `/trainer-allocations/${row._id}`, []);
    }
    if (section === 'slotAllocations' && staff && row.status === 'active') {
      add('Change slot', 'put', `/time-slots/change/${row._id}`, [field('newSlotId', 'New slot', 'slots')]);
      if (isAdmin) add('Cancel slot allocation', 'delete', `/time-slots/allocate/${row._id}`, []);
    }
    if (section === 'notifications' && !row.isRead) add('Mark read', 'put', `/notifications/${row._id}/read`, []);
    if (section === 'settings' && isAdmin && row.isEditable) add('Edit setting', 'put', `/settings/${row.key}`, [field('value', row.description || label(row.key), typeof row.value === 'boolean' ? 'checkbox' : typeof row.value === 'number' ? 'number' : 'text')]);
    if (section === 'users' && isAdmin) add(row.isActive ? 'Deactivate' : 'Reactivate', 'patch', `/users/${row._id}/status`, [field('isActive', 'Account active', 'checkbox')], { isActive: !row.isActive });
    if (section === 'stripe' && row.status !== 'completed') add('Retry activation', 'post', `/payments/stripe/events/${row._id}/retry`, []);
    if (section === 'slots' && staff) add('Allocate member', 'post', '/time-slots/allocate', [member, field('membershipId', 'Membership', 'memberships'), slot], { slotId: row._id });
    return buttons;
  };
  return <div className="dash-content operations">
    <div className="toolbar operation-tools">
      <button className="outline-btn" onClick={() => setRevision(v => v + 1)}><RefreshCw size={16}/> Refresh</button>
      <button className="outline-btn" disabled={!visible.length} onClick={exportRows}><Download size={16}/> Export visible rows</button>
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
      {section === 'reports' && <label>Report<select value={report} onChange={e => setReport(e.target.value)}>{reportTypes.map(type => <option key={type}>{type}</option>)}</select></label>}
      {['reports', 'attendance', 'payments'].includes(section) && <>
        <label>From<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></label>
        <label>Through<input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}/></label>
      </>}
    </div>
    {section === 'slots' && <p>Slots recur on the displayed weekday. A slot is confirmed only after the server validates capacity and payment.</p>}
    {error && <div className="error-message management-message" role="alert">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    {summary && section === 'reports' && <div className="stats">{Object.entries(summary).filter(([,v]) => typeof v !== 'object').map(([key,v]) => <article key={key}><p>{label(key)}</p><h3>{valueText(v)}</h3></article>)}</div>}
    {action && <div className="operation-modal" role="dialog" aria-modal="true" aria-label={action.title}>
      <form className="registration-form operation-form" onSubmit={submit}>
        <h2>{action.title}</h2>
        {error && <p role="alert" className="error-message">{error}</p>}
        {!action.fields.length && <p>Confirm this action. It will be recorded against your account.</p>}
        <div className="form-grid">{action.fields.map(f => <label key={f.name}>{f.label}
          {f.type === 'sessions' ? <div className="session-inputs">
            {(values.sessions || []).map((session, index) => <div className="session-row" key={index}>
              {['name', 'startTime', 'endTime'].map(key => <input key={key} aria-label={`Session ${index + 1} ${label(key)}`} required type={key === 'name' ? 'text' : 'time'} value={session[key] || ''} onChange={e => setValues({ ...values, sessions: values.sessions.map((current, i) => i === index ? { ...current, [key]: e.target.value } : current) })}/>)}
              <button type="button" className="outline-btn" onClick={() => setValues({ ...values, sessions: values.sessions.filter((_, i) => i !== index) })}>Remove session</button>
            </div>)}
            <button type="button" className="outline-btn" onClick={() => setValues({ ...values, sessions: [...(values.sessions || []), { name: '', startTime: '', endTime: '' }] })}>Add session</button>
          </div> : f.type === 'select' || choices[f.type] ? <select required={f.options !== true} value={values[f.name] || ''} onChange={e => setValues({ ...values, [f.name]: e.target.value })}>
            <option value="">Select {f.label}</option>{(choices[f.type] || f.options || []).map(option => typeof option === 'string' ? <option key={option} value={option}>{label(option)}</option> :
              <option key={option._id} value={option._id}>{option.fullName || option.name || option.member?.fullName || option._id} {option.dayOfWeek || ''} {option.startTime && !option.startTime.includes('T') ? option.startTime : ''} {option.membershipPlan?.name || ''} {option.pendingAmount != null ? `? INR ${option.pendingAmount} due` : ''}</option>)}
          </select> : f.type === 'days' ? <div className="day-options">{days.map(d => <label key={d}><input type="checkbox" checked={(values[f.name] || []).includes(d)} onChange={e => setValues({ ...values, [f.name]: e.target.checked ? [...(values[f.name] || []), d] : values[f.name].filter(x => x !== d) })}/>{label(d)}</label>)}</div> :
          <input type={['optional', 'list'].includes(f.type) || ['members','trainers','slots','plans','memberships'].includes(f.type) ? 'text' : f.type}
            required={!f.optional && !['optional','checkbox'].includes(f.type)} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined}
            minLength={f.type === 'password' ? section === 'users' ? 12 : 8 : undefined} maxLength={f.type === 'password' ? 72 : undefined}
            checked={f.type === 'checkbox' ? Boolean(values[f.name]) : undefined} value={f.type === 'checkbox' ? undefined : values[f.name] ?? ''}
            onChange={e => setValues({ ...values, [f.name]: f.type === 'checkbox' ? e.target.checked : e.target.value })}/>}</label>)}</div>
        <div className="form-actions"><button type="button" className="outline-btn" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className="lime-btn" disabled={busy}>{busy ? 'Saving?' : 'Confirm'}</button></div>
      </form>
    </div>}
    {details && <div className="table-card payment-receipt"><h2>{details.fullName}</h2><dl>{Object.entries(details).filter(([key]) => !['_id', '__v', 'user'].includes(key)).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{valueText(value, key)}</dd></div>)}</dl><button className="outline-btn" onClick={() => setDetails(null)}>Close profile</button></div>}
    {receipt && <div className="table-card payment-receipt">
      <h2>PULSEFIT ? Payment receipt</h2><p>{receipt.transactionId}</p>
      <p>Member: {receipt.member?.fullName || user.name}</p><p>Received: INR {receipt.amount}</p>
      <p>Method: {label(receipt.paymentMethod)} ? Status: {label(receipt.paymentStatus)}</p><p>Date: {valueText(receipt.paymentDate, 'paymentDate')}</p>
      <button className="lime-btn" onClick={() => window.print()}>Print receipt</button><button className="outline-btn" onClick={() => setReceipt(null)}>Close receipt</button>
    </div>}
    {loading ? <p role="status"><Loader2 className="animate-spin"/> Loading?</p> : <section className="table-card"><div className="table-scroll"><table>
      <thead><tr>{columns.map(key => <th key={key}>{label(key)}</th>)}<th>Actions</th></tr></thead>
      <tbody>{visible.length ? visible.map((row, i) => <tr key={row._id || row.slotId || i}>{columns.map(key => <td key={key}>{valueText(row[key], key)}</td>)}<td><div className="row-actions">{rowActions(row)}</div></td></tr>) : <tr><td colSpan={columns.length + 1}>No records found.</td></tr>}</tbody>
    </table></div></section>}
    {pagination && <div className="form-actions"><button className="outline-btn" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><span>Page {page} of {pagination.pages || 1} ? {pagination.total} records</span><button className="outline-btn" disabled={page >= pagination.pages} onClick={() => setPage(v => v + 1)}>Next</button></div>}
  </div>;
}
function localInput(value) {
  if (!value) return '';
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
