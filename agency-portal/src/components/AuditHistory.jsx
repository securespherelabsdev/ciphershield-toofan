import React, { useEffect, useState } from 'react';
import { apiFetch } from '../auth';
import { STATUS_LABEL, STATUS_COLORS } from '../workflow';

const ACTION_META = {
  VIEWED:     { label: 'Viewed',             icon: '👁', color: 'text-slate-500' },
  REVIEW:     { label: 'Promoted to Review', icon: '↑',  color: 'text-amber-400' },
  DISPATCH:   { label: 'Dispatched to Field',icon: '→',  color: 'text-teal' },
  ESCALATED:  { label: 'Escalated',          icon: '⬆',  color: 'text-purple-400' },
  ACTIONED:   { label: 'Action Taken',       icon: '✓',  color: 'text-green-400' },
  NO_FINDING: { label: 'No Finding',         icon: '○',  color: 'text-slate-400' },
  QUARANTINE: { label: 'Quarantined',        icon: '⊘',  color: 'text-red-400' },
};

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditHistory({ reportId }) {
  const [history, setHistory] = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!reportId) return;
    apiFetch(`/reports/${reportId}/history`)
      .then((r) => r?.json())
      .then((d) => setHistory(d?.history || []))
      .catch((e) => setError(e.message));
  }, [reportId]);

  if (error) return (
    <p className="text-xs text-red-400 py-2">{error}</p>
  );
  if (!history) return (
    <p className="text-xs text-slate-600 animate-pulse py-2">Loading history…</p>
  );
  if (history.length === 0) return (
    <p className="text-xs text-slate-600 py-2">No activity recorded yet.</p>
  );

  return (
    <ol className="relative border-l border-white/8 ml-2 space-y-0">
      {history.map((entry, i) => {
        const meta = ACTION_META[entry.action] || { label: entry.action, icon: '·', color: 'text-slate-500' };
        const isLast = i === history.length - 1;
        return (
          <li key={i} className={`ml-5 ${isLast ? 'pb-0' : 'pb-5'}`}>
            {/* Timeline dot */}
            <span className={`absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full
              bg-[#151f2e] border border-white/15 text-[10px] ${meta.color}`}>
              {meta.icon}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-semibold ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-xs text-slate-500">
                {entry.email}
                <span className="mx-1 opacity-40">·</span>
                {entry.agency?.replace('_', ' ')}
                <span className="mx-1 opacity-40">·</span>
                {fmt(entry.actioned_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
