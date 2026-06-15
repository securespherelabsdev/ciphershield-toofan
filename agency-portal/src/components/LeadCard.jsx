import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConfidenceBadge from './ConfidenceBadge';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function FlagPill({ criticalFlags, flagCount }) {
  if (flagCount === 0) return null;

  if (criticalFlags > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 uppercase tracking-wide whitespace-nowrap">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M4 0.5L0.5 7.5h7L4 0.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
        </svg>
        {criticalFlags} critical
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 uppercase tracking-wide whitespace-nowrap">
      ⚑ {flagCount} flag{flagCount > 1 ? 's' : ''}
    </span>
  );
}

export default function LeadCard({ report }) {
  const navigate    = useNavigate();
  const shortId     = report.id?.slice(0, 8).toUpperCase();
  const criticals   = report.critical_flags || 0;
  const flagCount   = report.flag_count || 0;
  const hasCritical = criticals > 0;

  return (
    <tr
      className={`border-b border-slate-100 cursor-pointer transition-colors group
        ${hasCritical ? 'hover:bg-red-50/40 bg-red-50/10' : 'hover:bg-blue-50/50'}`}
      onClick={() => navigate(`/leads/${report.id}`)}
    >
      <td className="px-4 py-3.5">
        <span className="font-mono text-xs text-slate-400 group-hover:text-slate-600">{shortId}…</span>
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-700 font-medium">
        {report.district || <span className="text-slate-400 italic text-xs">Unspecified</span>}
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-600">{report.report_type}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ConfidenceBadge status={report.status} score={report.fp_score} />
          <FlagPill criticalFlags={criticals} flagCount={flagCount} />
        </div>
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-400">{timeAgo(report.created_at)}</td>
      <td className="px-4 py-3.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`ml-auto transition-colors ${hasCritical ? 'text-red-300 group-hover:text-red-500' : 'text-slate-300 group-hover:text-blue-500'}`}>
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </td>
    </tr>
  );
}
