import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../auth';

const ACTION_LABELS = {
  STATUS_CHANGE:    'Status Changed',
  DISPATCH:         'Dispatched',
  ESCALATED:        'Escalated',
  ACTIONED:         'Actioned',
  NO_FINDING:       'No Finding',
  QUARANTINE:       'Quarantined',
  REVIEW:           'Moved to Review',
  LOGIN:            'Login',
  VIEW:             'Report Viewed',
};

const AGENCY_LABELS = {
  KERALA_POLICE: 'Kerala Police',
  EXCISE:        'Excise',
  CYBERDOME:     'Cyber Dome',
};

function ActionTag({ action }) {
  const label = ACTION_LABELS[action] || action;
  const isWrite = ['STATUS_CHANGE','DISPATCH','ESCALATED','ACTIONED','NO_FINDING','QUARANTINE','REVIEW'].includes(action);
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
      ${isWrite
        ? 'bg-blue-50 text-blue-700 border border-blue-200'
        : 'bg-slate-50 text-slate-500 border border-slate-200'
      }`}>
      {label}
    </span>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2
        focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer"
    >
      {children}
    </select>
  );
}

export default function ActivityLog() {
  const [entries,  setEntries]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [page,     setPage]     = useState(1);
  const [agency,   setAgency]   = useState('');
  const [action,   setAction]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page });
    if (agency) params.set('agency', agency);
    if (action) params.set('action', action);

    apiFetch(`/activity?${params}`)
      .then((r) => r?.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setEntries(d?.entries || []);
        setTotal(d?.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, agency, action]);

  useEffect(() => { load(); }, [load]);

  function handleFilterChange(setter) {
    return (v) => { setter(v); setPage(1); };
  }

  const totalPages = Math.ceil(total / 50);
  const start = (page - 1) * 50 + 1;
  const end   = Math.min(page * 50, total);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {loading ? 'Loading…' : total === 0 ? 'No entries' : `Showing ${start}–${end} of ${total} entries`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Agency" value={agency} onChange={handleFilterChange(setAgency)}>
          <option value="">All Agencies</option>
          {Object.entries(AGENCY_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </FilterSelect>

        <FilterSelect label="Action type" value={action} onChange={handleFilterChange(setAction)}>
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </FilterSelect>

        {(agency || action) && (
          <button
            onClick={() => { setAgency(''); setAction(''); setPage(1); }}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg
              px-3 py-2 transition-colors flex items-center gap-1.5 bg-white"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error} — <button onClick={load} className="underline">retry</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-50">
              <th className="text-left px-4 py-3 font-medium">When</th>
              <th className="text-left px-4 py-3 font-medium">Agency</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
              <th className="text-left px-4 py-3 font-medium">Report</th>
              <th className="text-left px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400 animate-pulse text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-slate-600 font-medium mb-1">No activity yet</p>
                  <p className="text-slate-400 text-xs">
                    {(agency || action) ? 'Try clearing the filters.' : 'Actions will appear here once officers begin working leads.'}
                  </p>
                </td>
              </tr>
            )}
            {!loading && entries.map((e, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {AGENCY_LABELS[e.agency] || e.agency || '—'}
                </td>
                <td className="px-4 py-3">
                  <ActionTag action={e.action} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {e.report_id ? e.report_id.slice(0, 8).toUpperCase() + '…' : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                  {e.note || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500 text-xs">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600
                disabled:opacity-30 hover:bg-slate-50 transition-colors text-xs"
            >
              ← Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600
                disabled:opacity-30 hover:bg-slate-50 transition-colors text-xs"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
