import React, { useState } from 'react';
import { apiFetch } from '../auth';

const DEPARTMENTS = [
  { value: 'KERALA_POLICE', label: 'Kerala Police',     color: 'text-blue-400 bg-blue-500/8 border-blue-500/20' },
  { value: 'EXCISE',        label: 'Excise Department', color: 'text-amber-400 bg-amber-500/8 border-amber-500/20' },
  { value: 'CYBERDOME',     label: 'Cyber Dome',        color: 'text-teal bg-teal/8 border-teal/20' },
];

export default function AssignmentPanel({ reportId, current, onChange }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const dept = DEPARTMENTS.find((d) => d.value === current);

  async function assign(value) {
    if (value === current) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await apiFetch(`/reports/${reportId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: value || null }),
      });
      const data = await res?.json();
      if (!res?.ok) throw new Error(data?.error || 'Assignment failed.');
      onChange(data.assigned_to);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Current assignment */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Currently:</span>
        {dept ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${dept.color}`}>
            {dept.label}
          </span>
        ) : (
          <span className="text-xs text-slate-600 italic">Unassigned</span>
        )}
        {saving && <span className="text-xs text-slate-600 animate-pulse">Saving…</span>}
      </div>

      {/* Department buttons */}
      <div className="flex flex-wrap gap-2">
        {DEPARTMENTS.map((d) => (
          <button
            key={d.value}
            onClick={() => assign(d.value)}
            disabled={saving}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
              ${current === d.value
                ? `${d.color} opacity-100`
                : 'bg-white/4 border-white/10 text-slate-400 hover:border-white/20 hover:text-white opacity-70 hover:opacity-100'
              } disabled:cursor-not-allowed`}
          >
            {d.label}
          </button>
        ))}
        {current && (
          <button
            onClick={() => assign(null)}
            disabled={saving}
            className="text-xs text-slate-600 hover:text-slate-400 px-2 py-1.5 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <p className="text-[10px] text-slate-700">
        Assignment routes the case to the responsible team. It does not restrict other agencies from viewing it.
      </p>
    </div>
  );
}
