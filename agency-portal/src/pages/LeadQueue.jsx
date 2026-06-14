import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth';
import LeadCard from '../components/LeadCard';
import ErrorBoundary from '../components/ErrorBoundary';

const DISTRICTS = [
  'Thiruvananthapuram','Kollam','Pathanamthitta','Alappuzha','Kottayam',
  'Idukki','Ernakulam','Thrissur','Palakkad','Malappuram',
  'Kozhikode','Wayanad','Kannur','Kasaragod',
];
const REPORT_TYPES = [
  'Drug Sale Activity','Drug Manufacturing','Drug Transportation',
  'Storage Location','Suspicious Person or Activity','Other',
];
const STATUSES = [
  { value: 'QUARANTINE', label: 'Quarantined' },
  { value: 'REVIEW',     label: 'Pending Review' },
  { value: 'DISPATCH',   label: 'Dispatched' },
  { value: 'ESCALATED',  label: 'Escalated' },
  { value: 'ACTIONED',   label: 'Actioned' },
  { value: 'NO_FINDING', label: 'No Finding' },
];

function FilterSelect({ label, value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2
        focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
        transition-colors appearance-none cursor-pointer shadow-sm"
    >
      {children}
    </select>
  );
}

export default function LeadQueue({ title, defaultStatus }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const page       = parseInt(searchParams.get('page') || '1');
  const district   = searchParams.get('district') || '';
  const reportType = searchParams.get('report_type') || '';
  const status     = defaultStatus || searchParams.get('status') || '';
  const scoreMin   = searchParams.get('score_min') || '';
  const scoreMax   = searchParams.get('score_max') || '';

  const fetchReports = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page });
    if (district)   params.set('district', district);
    if (reportType) params.set('report_type', reportType);
    if (status)     params.set('status', status);
    if (scoreMin)   params.set('score_min', scoreMin);
    if (scoreMax)   params.set('score_max', scoreMax);

    apiFetch(`/reports?${params}`)
      .then((r) => r?.json())
      .then((d) => { setReports(d?.reports || []); setTotal(d?.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, district, reportType, status, scoreMin, scoreMax]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function setFilter(key, val) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set(key, val); else next.delete(key);
      next.delete('page');
      return next;
    });
  }

  const totalPages = Math.ceil(total / 20);
  const hasFilters = district || reportType || status || scoreMin || scoreMax;
  const startIndex = (page - 1) * 20 + 1;
  const endIndex   = Math.min(page * 20, total);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title || 'Lead Queue'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? 'Loading…' : total === 0 ? 'No leads found' : `Showing ${startIndex}–${endIndex} of ${total}`}
          </p>
        </div>
        {hasFilters && (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 bg-white rounded-lg
              px-3 py-1.5 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Clear filters
          </button>
        )}
      </div>

      {!defaultStatus && (
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="District" value={district} onChange={(v) => setFilter('district', v)}>
            <option value="">All Districts</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </FilterSelect>
          <FilterSelect label="Report type" value={reportType} onChange={(v) => setFilter('report_type', v)}>
            <option value="">All Types</option>
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={(v) => setFilter('status', v)}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </FilterSelect>
          <div className="flex items-center gap-1.5">
            <input type="number" min="0" max="100" placeholder="Score ≥" value={scoreMin}
              onChange={(e) => setFilter('score_min', e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2
                w-24 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="number" min="0" max="100" placeholder="Score ≤" value={scoreMax}
              onChange={(e) => setFilter('score_max', e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2
                w-24 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm" />
          </div>
        </div>
      )}

      <ErrorBoundary title="Could not load leads">
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error} — <button onClick={fetchReports} className="underline">retry</button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">District</th>
                <th className="text-left px-4 py-3 font-semibold">Report Type</th>
                <th className="text-left px-4 py-3 font-semibold">Status · Score</th>
                <th className="text-left px-4 py-3 font-semibold">Received</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 animate-pulse">Loading leads…</td></tr>
              )}
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-slate-600 font-medium mb-1">No leads found</p>
                    <p className="text-slate-400 text-xs">
                      {hasFilters ? 'Try adjusting or clearing your filters.' : 'Submissions will appear here when received.'}
                    </p>
                  </td>
                </tr>
              )}
              {!loading && reports.map((r) => <LeadCard key={r.id} report={r} />)}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-slate-400 text-xs">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600
                  disabled:opacity-40 hover:bg-slate-50 transition-colors text-xs shadow-sm">
                ← Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setFilter('page', String(page + 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600
                  disabled:opacity-40 hover:bg-slate-50 transition-colors text-xs shadow-sm">
                Next →
              </button>
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
