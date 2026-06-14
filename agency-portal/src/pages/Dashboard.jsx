import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth';
import ConfidenceBadge from '../components/ConfidenceBadge';
import ErrorBoundary from '../components/ErrorBoundary';

function StatCard({ label, value, sub, accent, color }) {
  const bg      = accent ? 'bg-[#1B6CA8] text-white' : 'bg-white';
  const valClr  = accent ? 'text-white' : (color || 'text-slate-900');
  const lblClr  = accent ? 'text-blue-200' : 'text-slate-500';
  const subClr  = accent ? 'text-blue-200' : 'text-slate-400';
  return (
    <div className={`${bg} rounded-xl p-5 border ${accent ? 'border-blue-700' : 'border-slate-200'} shadow-sm`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${lblClr}`}>{label}</p>
      <p className={`text-3xl font-bold ${valClr}`}>
        {value ?? <span className="text-slate-300">—</span>}
      </p>
      {sub && <p className={`text-xs mt-1 ${subClr}`}>{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, color = 'text-slate-700' }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value ?? '—'}</span>
    </div>
  );
}

function RecentRow({ report, onClick }) {
  const timeStr = new Date(report.created_at || report.outcome_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
  const DEPT = { KERALA_POLICE: 'KP', EXCISE: 'EX', CYBERDOME: 'CD' };
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={onClick}>
      <td className="px-4 py-3 font-mono text-xs text-slate-400">{report.id?.slice(0,8).toUpperCase()}…</td>
      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{report.report_type}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{report.district || '—'}</td>
      <td className="px-4 py-3">
        {report.assigned_to
          ? <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{DEPT[report.assigned_to]}</span>
          : <span className="text-xs text-slate-300 italic">Unassigned</span>}
      </td>
      <td className="px-4 py-3"><ConfidenceBadge status={report.status} score={report.fp_score} /></td>
      <td className="px-4 py-3 text-xs text-slate-400">{timeStr}</td>
    </tr>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/stats')
      .then((r) => r?.json())
      .then((d) => { if (d?.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Intelligence overview — today</p>
      </div>

      <ErrorBoundary title="Could not load statistics">
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

        {/* Primary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Leads"       value={data?.totals?.total}            accent />
          <StatCard label="Awaiting Review"   value={data?.totals?.awaiting_review}  color="text-amber-600" />
          <StatCard label="In Field"          value={data?.totals?.dispatched}       color="text-blue-600" />
          <StatCard label="Actioned (7 days)" value={data?.totals?.actioned_this_week} sub="Closed this week" color="text-green-600" />
        </div>

        {/* Assignment breakdown + clusters row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Assignment status */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Case Assignment</h2>
            </div>
            <div className="px-5 py-2">
              <MiniStat
                label="Unassigned (open)"
                value={data?.totals?.unassigned ?? '…'}
                color={data?.totals?.unassigned > 0 ? 'text-amber-600' : 'text-green-600'}
              />
              <MiniStat label="Kerala Police" value={data?.assigned_breakdown?.KERALA_POLICE ?? '…'} color="text-blue-600" />
              <MiniStat label="Excise Dept."  value={data?.assigned_breakdown?.EXCISE ?? '…'} color="text-amber-600" />
              <MiniStat label="Cyber Dome"    value={data?.assigned_breakdown?.CYBERDOME ?? '…'} color="text-teal" />
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => navigate('/leads')}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View lead queue →
              </button>
            </div>
          </div>

          {/* Pattern alerts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-amber-500">
                <path d="M6.5 1.5l1 3h3l-2.5 1.8 1 3-2.5-1.8-2.5 1.8 1-3L3.5 4.5h3z"
                  stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pattern Alerts</h2>
            </div>
            <div className="px-5 py-2 flex-1">
              {!data && <p className="text-sm text-slate-400 py-3 animate-pulse">Loading…</p>}
              {data && (!data.clusters || data.clusters.length === 0) && (
                <p className="text-sm text-slate-400 py-3">No patterns detected this week.</p>
              )}
              {data?.clusters?.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/leads?district=${encodeURIComponent(c.district)}&report_type=${encodeURIComponent(c.report_type)}`)}
                  className="w-full flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0
                    hover:bg-amber-50 rounded px-1 -mx-1 transition-colors group text-left"
                >
                  <span className="text-sm text-slate-700">
                    <span className="font-semibold">{c.district}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-500">{c.report_type}</span>
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 ml-2 flex-shrink-0">
                    {c.cnt}×
                  </span>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-400">Same district + type, 3+ times in 7 days.</p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Activity</h2>
            <button onClick={() => navigate('/leads')} className="text-xs text-blue-600 hover:underline font-medium">
              View all →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest">
                <th className="text-left px-4 py-2.5 font-semibold">ID</th>
                <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold">District</th>
                <th className="text-left px-4 py-2.5 font-semibold">Assigned</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 animate-pulse text-sm">Loading…</td></tr>
              )}
              {data && !data.recent_activity?.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">No reports yet.</td></tr>
              )}
              {data?.recent_activity?.map((r) => (
                <RecentRow key={r.id} report={r} onClick={() => navigate(`/leads/${r.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      </ErrorBoundary>
    </div>
  );
}
