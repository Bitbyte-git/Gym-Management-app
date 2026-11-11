import React from 'react';

/**
 * Base Skeleton component with shimmer animation.
 */
export function Skeleton({
  variant = 'rect', // 'rect' | 'text' | 'circle'
  width,
  height,
  className = '',
  style = {},
  ...rest
}) {
  const variantClass = variant === 'circle' ? 'skeleton-circle' : variant === 'text' ? 'skeleton-text' : '';
  const inlineStyle = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...style,
  };

  return (
    <span
      className={`skeleton ${variantClass} ${className}`.trim()}
      style={inlineStyle}
      aria-hidden="true"
      {...rest}
    />
  );
}

/**
 * Table Skeleton for data lists (Members, Trainers, Attendance, Payments, Slots, etc.)
 */
export function TableSkeleton({ rows = 6, cols = 5, showHeader = true, className = '' }) {
  return (
    <section className={`skeleton-table-card ${className}`} role="status" aria-label="Loading table data...">
      {showHeader && (
        <div className="skeleton-table-header">
          <div>
            <Skeleton width="110px" height="12px" style={{ marginBottom: 6 }} />
            <Skeleton width="180px" height="22px" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Skeleton width="140px" height="36px" style={{ borderRadius: 6 }} />
            <Skeleton width="100px" height="36px" style={{ borderRadius: 6 }} />
          </div>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        {/* Table column headers */}
        <div className="skeleton-table-row" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={`th-${c}`} style={{ flex: c === 0 ? 1.6 : 1, minWidth: 80 }}>
              <Skeleton width="70%" height="13px" style={{ borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {/* Table body rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="skeleton-table-row">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={`td-${r}-${c}`} style={{ flex: c === 0 ? 1.6 : 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 80 }}>
                {c === 0 && <Skeleton variant="circle" width="34px" height="34px" style={{ flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <Skeleton width={c === 0 ? '75%' : `${50 + ((r + c) * 11) % 40}%`} height="14px" />
                  {c === 0 && <Skeleton width="45%" height="10px" style={{ marginTop: 4 }} />}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * KPI Stat Cards Skeleton (Grid of 4 or 2 cards)
 */
export function StatsSkeleton({ count = 4 }) {
  return (
    <section className="stats" role="status" aria-label="Loading metrics...">
      {Array.from({ length: count }).map((_, i) => (
        <article key={`stat-${i}`} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
            <Skeleton variant="circle" width="22px" height="22px" />
          </div>
          <div>
            <Skeleton width="60%" height="11px" style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height="26px" style={{ marginBottom: 6 }} />
            <Skeleton width="45%" height="10px" />
          </div>
        </article>
      ))}
    </section>
  );
}

/**
 * Dashboard inner content skeleton (KPIs, Charts, Table)
 */
export function DashboardContentSkeleton({ role = 'admin' }) {
  return (
    <div className="dash-content" role="status" aria-busy="true" aria-label="Loading dashboard...">
      {/* Welcome Banner Skeleton */}
      <div className="welcome admin-welcome" style={{ pointerEvents: 'none' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="130px" height="12px" style={{ marginBottom: 10 }} />
          <Skeleton width="280px" height="30px" style={{ marginBottom: 8 }} />
          <Skeleton width="420px" height="14px" />
        </div>
        <div className="admin-quick-actions" style={{ display: 'flex', gap: 10 }}>
          <Skeleton width="140px" height="38px" style={{ borderRadius: 6 }} />
          <Skeleton width="110px" height="38px" style={{ borderRadius: 6 }} />
        </div>
      </div>

      {/* Stats Cards */}
      <StatsSkeleton count={role === 'trainer' ? 2 : 4} />

      {/* Analytics & Charts Skeleton (for admin/staff) */}
      {(role === 'admin' || role === 'reception') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          <div className="skeleton-card" style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton width="140px" height="16px" />
              <Skeleton width="60px" height="16px" />
            </div>
            <Skeleton width="100%" height="160px" style={{ borderRadius: 8 }} />
          </div>
          <div className="skeleton-card" style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton width="140px" height="16px" />
              <Skeleton width="60px" height="16px" />
            </div>
            <Skeleton width="100%" height="160px" style={{ borderRadius: 8 }} />
          </div>
        </div>
      )}

      {/* Recent Members / Data Table Skeleton */}
      <div style={{ marginTop: 16 }}>
        <TableSkeleton rows={5} cols={3} />
      </div>
    </div>
  );
}

/**
 * Full Dashboard View Skeleton with Sidebar and Header
 */
export function DashboardSkeleton({ role = 'admin' }) {
  return (
    <div className="skeleton-dashboard-shell" role="status" aria-busy="true" aria-label="Loading workspace...">
      {/* Sidebar Skeleton */}
      <aside className="skeleton-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Skeleton variant="circle" width="40px" height="40px" />
          <div style={{ flex: 1 }}>
            <Skeleton width="80%" height="14px" style={{ marginBottom: 4 }} />
            <Skeleton width="50%" height="10px" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8, marginBottom: 12 }}>
          <Skeleton width="32px" height="32px" style={{ borderRadius: 6 }} />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height="12px" style={{ marginBottom: 4 }} />
            <Skeleton width="50%" height="9px" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`nav-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
              <Skeleton width="18px" height="18px" style={{ borderRadius: 4 }} />
              <Skeleton width={`${55 + (i * 9) % 35}%`} height="13px" />
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton variant="circle" width="34px" height="34px" />
          <div style={{ flex: 1 }}>
            <Skeleton width="65%" height="12px" style={{ marginBottom: 4 }} />
            <Skeleton width="45%" height="9px" />
          </div>
        </div>
      </aside>

      {/* Main Workspace Skeleton */}
      <div className="skeleton-main-workspace">
        <header className="skeleton-workspace-header">
          <div>
            <Skeleton width="120px" height="11px" style={{ marginBottom: 6 }} />
            <Skeleton width="160px" height="22px" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width="220px" height="38px" style={{ borderRadius: 6 }} />
            <Skeleton width="140px" height="38px" style={{ borderRadius: 6 }} />
          </div>
        </header>
        <DashboardContentSkeleton role={role} />
      </div>
    </div>
  );
}

/**
 * Public Page Skeleton (Landing, Programs, Schedule, Trainers, Memberships, Facilities, Contact)
 */
export function PublicPageSkeleton() {
  return (
    <div className="skeleton-app-shell" role="status" aria-busy="true" aria-label="Loading page...">
      {/* Public Navbar Skeleton */}
      <header className="skeleton-public-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton variant="circle" width="42px" height="42px" />
          <div>
            <Skeleton width="140px" height="16px" style={{ marginBottom: 4 }} />
            <Skeleton width="90px" height="10px" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }} className="desktop">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`nav-${i}`} width="75px" height="14px" />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton width="105px" height="38px" style={{ borderRadius: 4 }} />
          <Skeleton width="115px" height="38px" style={{ borderRadius: 4 }} />
        </div>
      </header>

      {/* Public Hero Skeleton */}
      <div className="skeleton-hero">
        <div>
          <Skeleton width="160px" height="14px" style={{ marginBottom: 14 }} />
          <Skeleton width="90%" height="48px" style={{ marginBottom: 12 }} />
          <Skeleton width="75%" height="48px" style={{ marginBottom: 20 }} />
          <Skeleton width="85%" height="16px" style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height="16px" style={{ marginBottom: 30 }} />
          <div style={{ display: 'flex', gap: 14 }}>
            <Skeleton width="160px" height="46px" style={{ borderRadius: 6 }} />
            <Skeleton width="140px" height="46px" style={{ borderRadius: 6 }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="skeleton-card" style={{ width: '100%', maxWidth: 440, height: 420, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Skeleton width="100%" height="240px" style={{ borderRadius: 8 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton width="70%" height="16px" />
              <Skeleton width="90%" height="12px" />
              <Skeleton width="40%" height="12px" />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid Skeleton */}
      <div style={{ maxWidth: 1180, margin: '20px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`feat-${i}`} className="skeleton-card" style={{ padding: 24 }}>
            <Skeleton variant="circle" width="44px" height="44px" style={{ marginBottom: 16 }} />
            <Skeleton width="70%" height="18px" style={{ marginBottom: 10 }} />
            <Skeleton width="95%" height="13px" style={{ marginBottom: 6 }} />
            <Skeleton width="85%" height="13px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Biometric Kiosk Attendance Screen Skeleton
 */
export function KioskSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="status"
      aria-busy="true"
      aria-label="Loading biometric kiosk..."
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 460 }}>
        <Skeleton variant="circle" width="72px" height="72px" />
        <Skeleton width="220px" height="24px" />
        <Skeleton width="160px" height="12px" style={{ marginBottom: 20 }} />

        {/* Fingerprint Scanner Circle */}
        <div style={{ width: 140, height: 140, borderRadius: '50%', border: '2px dashed rgba(198, 255, 0, 0.25)', display: 'grid', placeItems: 'center', margin: '16px 0' }}>
          <Skeleton variant="circle" width="100px" height="100px" />
        </div>

        <Skeleton width="200px" height="18px" />
        <Skeleton width="280px" height="14px" />
      </div>
    </div>
  );
}

/**
 * Auth (Login / Register) Page Skeleton
 */
export function AuthSkeleton() {
  return (
    <div className="skeleton-app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 20 }} role="status" aria-busy="true" aria-label="Loading authentication...">
      <div className="skeleton-card" style={{ width: '100%', maxWidth: 460, padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <Skeleton variant="circle" width="56px" height="56px" style={{ marginBottom: 12 }} />
          <Skeleton width="180px" height="22px" style={{ marginBottom: 8 }} />
          <Skeleton width="140px" height="12px" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Skeleton width="90px" height="12px" style={{ marginBottom: 6 }} />
            <Skeleton width="100%" height="42px" style={{ borderRadius: 6 }} />
          </div>
          <div>
            <Skeleton width="90px" height="12px" style={{ marginBottom: 6 }} />
            <Skeleton width="100%" height="42px" style={{ borderRadius: 6 }} />
          </div>
          <Skeleton width="100%" height="46px" style={{ borderRadius: 6, marginTop: 10 }} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <Skeleton width="160px" height="14px" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Universal contextual App Skeleton fallback for Suspense & route transitions.
 */
export function AppSkeleton() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (path.startsWith('/kiosk')) {
    return <KioskSkeleton />;
  }
  if (path.startsWith('/admin') || path.startsWith('/reception') || path.startsWith('/trainer') || path.startsWith('/member')) {
    const roleMatch = path.split('/')[1] || 'admin';
    return <DashboardSkeleton role={roleMatch} />;
  }
  if (path === '/login' || path === '/register') {
    return <AuthSkeleton />;
  }

  return <PublicPageSkeleton />;
}

export default AppSkeleton;

