import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearSession, getAgency, getEmail } from '../auth';

function NavItem({ to, exact, icon, label, badge }) {
  const location = useLocation();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      end={exact}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
        ${isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-100'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 4.5h12M2 8h8M2 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLog = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AGENCY_META = {
  KERALA_POLICE: { label: 'Kerala Police',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  EXCISE:        { label: 'Excise Dept.',       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  CYBERDOME:     { label: 'Cyber Dome',         color: 'bg-teal/10 text-teal border-teal/30' },
};

export default function Sidebar({ pendingCount }) {
  const navigate    = useNavigate();
  const agency      = getAgency();
  const email       = getEmail();
  const isCyberdome = agency === 'CYBERDOME';
  const meta        = AGENCY_META[agency];

  async function handleLogout() {
    try {
      const { apiFetch } = await import('../auth');
      await apiFetch('/logout', { method: 'POST' });
    } catch {}
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0 shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#1B6CA8"/>
          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <p className="text-slate-900 font-bold text-sm leading-none">CipherShield</p>
          <p className="text-slate-400 text-[10px] mt-0.5">Agency Portal</p>
        </div>
      </div>

      {/* Agency badge */}
      {meta && (
        <div className={`mx-3 mt-3 px-3 py-2 rounded-lg border text-xs font-semibold ${meta.color}`}>
          {meta.label}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 mt-3 space-y-0.5">
        <NavItem to="/" exact icon={<IconGrid />} label="Dashboard" />
        <NavItem to="/leads" icon={<IconList />} label="Lead Queue" badge={pendingCount} />
        <NavItem to="/resolved" icon={<IconCheck />} label="Resolved Cases" />
        {isCyberdome && (
          <NavItem to="/activity" icon={<IconLog />} label="Activity Log" />
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-slate-100 pt-3 space-y-0.5">
        <NavItem to="/settings" exact icon={<IconSettings />} label="Settings" />
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <IconLogout />
          Sign Out
        </button>
        {email && (
          <p className="text-[10px] text-slate-400 px-3 pt-1 truncate">{email}</p>
        )}
      </div>
    </aside>
  );
}
