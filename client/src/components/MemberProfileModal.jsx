import { Activity, CalendarDays, HeartPulse, Mail, MapPin, Phone, ShieldCheck, UserRound, X } from 'lucide-react';

const text = value => value === undefined || value === null || value === '' ? 'Not provided' : String(value).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : 'Not provided';
const initials = name => String(name || 'Member').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

const Info = ({ icon: Icon, label, value }) => <div className="profile-info">
  <span><Icon size={16}/></span><div><small>{label}</small><strong>{value}</strong></div>
</div>;

export default function MemberProfileModal({ member, onClose }) {
  const account = member.user || {};
  const active = member.membershipStatus === 'active' && account.isActive !== false;
  return <div className="member-modal-overlay" role="dialog" aria-modal="true" aria-label={`${member.fullName} member profile`}>
    <article className="member-profile-modal">
      <header className="member-profile-hero">
        <button className="member-modal-close" onClick={onClose} aria-label="Close member profile"><X size={19}/></button>
        <div className="member-profile-avatar">{initials(member.fullName)}</div>
        <div className="member-profile-identity">
          <span>MEMBER PROFILE</span><h2>{member.fullName}</h2>
          <p>{member.memberId} <i/> Joined {date(member.createdAt)}</p>
        </div>
        <div className={`member-profile-status ${active ? 'active' : ''}`}><span/>{active ? 'Active member' : text(member.membershipStatus || 'Inactive')}</div>
      </header>

      <section className="member-profile-metrics">
        <div><small>HEIGHT</small><strong>{member.height ? `${member.height} cm` : '—'}</strong></div>
        <div><small>WEIGHT</small><strong>{member.weight ? `${member.weight} kg` : '—'}</strong></div>
        <div><small>FITNESS GOAL</small><strong>{text(member.fitnessGoal)}</strong></div>
        <div><small>EXPERIENCE</small><strong>{text(member.exerciseExperience)}</strong></div>
      </section>

      <div className="member-profile-body">
        <section className="member-profile-section">
          <div className="member-section-title"><UserRound/><div><h3>Personal information</h3><p>Identity and account details</p></div></div>
          <div className="member-info-grid">
            <Info icon={Mail} label="Email address" value={account.email || 'Not provided'}/>
            <Info icon={Phone} label="Mobile number" value={member.mobileNumber || 'Not provided'}/>
            <Info icon={CalendarDays} label="Date of birth" value={date(member.dateOfBirth)}/>
            <Info icon={UserRound} label="Gender" value={text(member.gender)}/>
            <Info icon={MapPin} label="Address" value={member.address || 'Not provided'}/>
            <Info icon={ShieldCheck} label="Registration" value={text(member.registrationStatus)}/>
          </div>
        </section>

        <section className="member-profile-section">
          <div className="member-section-title"><ShieldCheck/><div><h3>Emergency contact</h3><p>Primary contact in an emergency</p></div></div>
          <div className="member-info-grid compact">
            <Info icon={UserRound} label="Contact name" value={member.emergencyContactName || 'Not provided'}/>
            <Info icon={Phone} label="Contact phone" value={member.emergencyContactPhone || 'Not provided'}/>
          </div>
        </section>

        {['previousDiseases', 'recentOperations', 'healthNotes', 'physicalLimitations'].some(key => member[key] !== undefined) && <section className="member-profile-section health-section">
          <div className="member-section-title"><HeartPulse/><div><h3>Health and fitness notes</h3><p>Restricted wellness information</p></div></div>
          <div className="health-note-grid">
            <div><small>PREVIOUS CONDITIONS</small><p>{text(member.previousDiseases)}</p></div>
            <div><small>RECENT OPERATIONS</small><p>{text(member.recentOperations)}</p></div>
            <div><small>HEALTH NOTES</small><p>{member.healthNotes || 'None recorded'}</p></div>
            <div><small>PHYSICAL LIMITATIONS</small><p>{member.physicalLimitations || 'None recorded'}</p></div>
          </div>
          <p className="health-consent"><Activity size={14}/> Consent recorded {member.healthConsentAt ? `on ${date(member.healthConsentAt)}` : '—'}</p>
        </section>}
      </div>

      <footer className="member-profile-footer"><span><ShieldCheck size={15}/> Member data is visible according to your assigned role.</span><button className="lime-btn" onClick={onClose}>Done</button></footer>
    </article>
  </div>;
}
