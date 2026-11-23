import React from 'react';
import {
  CalendarDays,
  DoorOpen,
  ShieldCheck,
  UserPlus,
  CalendarRange,
  ChartNoAxesCombined,
  FileText,
  Settings,
  ChevronRight,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import Operations from '../pages/Operations';

export const SETTING_ELEMENTS = [
  {
    id: 'availability',
    path: 'availability',
    title: 'Trainer Availability',
    description: 'Set daily working hours, shift timings, maximum clients, and rest breaks for personal trainers.',
    icon: CalendarDays,
    badge: 'Shift Schedule',
    badgeColor: '#C6FF00',
    iconBg: 'rgba(198, 255, 0, 0.12)',
    iconColor: '#C6FF00'
  },
  {
    id: 'hours',
    path: 'hours',
    title: 'Gym Opening Hours',
    description: 'Define daily studio opening and closing times across all 7 weekdays and manage facility sessions.',
    icon: DoorOpen,
    badge: 'Studio Timings',
    badgeColor: '#7CC7E8',
    iconBg: 'rgba(124, 199, 232, 0.12)',
    iconColor: '#7CC7E8'
  },
  {
    id: 'users',
    path: 'users',
    title: 'Staff Accounts',
    description: 'Create and manage login access, passwords, and permission roles for administrators and reception staff.',
    icon: ShieldCheck,
    badge: 'Access Control',
    badgeColor: '#F6B94A',
    iconBg: 'rgba(246, 185, 74, 0.12)',
    iconColor: '#F6B94A'
  },
  {
    id: 'allocations',
    path: 'allocations',
    title: 'Member Trainers',
    description: 'Assign personal fitness coaches to registered members, review coaching periods, and reassign trainers.',
    icon: UserPlus,
    badge: 'Coaching',
    badgeColor: '#58D68D',
    iconBg: 'rgba(88, 214, 141, 0.12)',
    iconColor: '#58D68D'
  },
  {
    id: 'slotAllocations',
    path: 'slotAllocations',
    title: 'Member Slot Assignments',
    description: 'Allocate workout batches, change reserved training slots, and track hourly studio capacity.',
    icon: CalendarRange,
    badge: 'Batch Capacity',
    badgeColor: '#C6FF00',
    iconBg: 'rgba(198, 255, 0, 0.12)',
    iconColor: '#C6FF00'
  },
  {
    id: 'reports',
    path: 'reports',
    title: 'Reports & Analytics',
    description: 'Review gym operations, revenue streams, pending dues, member renewals, and attendance trends.',
    icon: ChartNoAxesCombined,
    badge: 'Business Intel',
    badgeColor: '#7CC7E8',
    iconBg: 'rgba(124, 199, 232, 0.12)',
    iconColor: '#7CC7E8'
  },
  {
    id: 'audit',
    path: 'audit',
    title: 'Audit Trail',
    description: 'Inspect sensitive administrative operations, staff activity timestamps, and security event logs.',
    icon: FileText,
    badge: 'Security Logs',
    badgeColor: '#FF6B72',
    iconBg: 'rgba(255, 107, 114, 0.12)',
    iconColor: '#FF6B72'
  }
];

export default function SettingsHub({ onNavigate, user, query }) {
  return (
    <div className="settings-hub">
      <div className="settings-hub-hero">
        <div className="settings-hub-eyebrow">
          <SlidersHorizontal size={14} />
          STUDIO MANAGEMENT & SYSTEM CONTROLS
        </div>
        <h2 className="settings-hub-title">Settings & Management Hub</h2>
        <p className="settings-hub-subtitle">
          Configure staff credentials, trainer schedules, opening hours, capacity allocations, and system options from a unified, spacious control center.
        </p>
      </div>

      <div className="settings-elements-section">
        <div className="settings-section-heading">
          <h3>Administrative Controls</h3>
          <span>Select an element to configure</span>
        </div>
        <div className="settings-elements-grid">
          {SETTING_ELEMENTS.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="settings-element-card"
                onClick={() => onNavigate(`/admin/${item.path}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigate(`/admin/${item.path}`);
                  }
                }}
              >
                <div className="settings-element-header">
                  <div
                    className="settings-element-icon-box"
                    style={{ background: item.iconBg, color: item.iconColor }}
                  >
                    <Icon size={20} />
                  </div>
                  <span
                    className="settings-element-badge"
                    style={{ color: item.badgeColor }}
                  >
                    {item.badge}
                  </span>
                </div>
                <div className="settings-element-body">
                  <h4 className="settings-element-name">{item.title}</h4>
                  <p className="settings-element-desc">{item.description}</p>
                </div>
                <div className="settings-element-footer">
                  <span className="settings-element-action">
                    Configure element <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="settings-system-table-section">
        <div className="settings-section-heading">
          <h3>System Rules & Defaults</h3>
          <span>Core application variables and studio defaults</span>
        </div>
        <Operations section="settings" user={user} query={query} />
      </div>
    </div>
  );
}
