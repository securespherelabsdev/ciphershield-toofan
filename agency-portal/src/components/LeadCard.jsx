import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConfidenceBadge from './ConfidenceBadge';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function LeadCard({ report }) {
  const navigate = useNavigate();
  const shortId  = report.id?.slice(0, 8).toUpperCase();

  return (
    <tr
      className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors group"
      onClick={() => navigate(`/leads/${report.id}`)}
    >
      <td className="px-4 py-3.5 font-mono text-xs text-slate-400 group-hover:text-slate-600">
        {shortId}…
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-700 font-medium">
        {report.district || <span className="text-slate-400 italic">Unspecified</span>}
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-600">{report.report_type}</td>
      <td className="px-4 py-3.5">
        <ConfidenceBadge status={report.status} score={report.fp_score} />
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-400">{timeAgo(report.created_at)}</td>
      <td className="px-4 py-3.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="text-slate-300 group-hover:text-blue-500 transition-colors ml-auto">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </td>
    </tr>
  );
}
