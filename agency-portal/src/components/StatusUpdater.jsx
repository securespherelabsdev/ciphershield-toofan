import React, { useState } from 'react';
import { apiFetch } from '../auth';
import { TRANSITIONS, ACTIONS, isTerminal, STATUS_LABEL } from '../workflow';
import ConfirmModal from './ConfirmModal';

const BTN_STYLE = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
  success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
  danger:  'border border-red-200 text-red-600 bg-red-50 hover:bg-red-100',
  neutral: 'border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100',
};

export default function StatusUpdater({ reportId, currentStatus, onUpdate }) {
  const [pending, setPending]     = useState(null); // the target status being confirmed
  const [note, setNote]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const nextStatuses = TRANSITIONS[currentStatus] || [];

  async function executeTransition() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: pending, note: note.trim() || undefined }),
      });
      if (!res || !res.ok) {
        const errBody = await res?.json().catch(() => ({}));
        throw new Error(errBody?.error || 'Update failed. Please try again.');
      }
      onUpdate(pending, note.trim());
      setPending(null);
      setNote('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (isTerminal(currentStatus)) {
    return (
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
        <p className="text-sm text-slate-500">
          This case is closed — <span className="text-slate-700 font-medium">{STATUS_LABEL[currentStatus]}</span>.
          No further actions are available.
        </p>
      </div>
    );
  }

  if (nextStatuses.length === 0) return null;

  const action = pending ? ACTIONS[pending] : null;

  return (
    <>
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((target) => {
            const a = ACTIONS[target];
            return (
              <button
                key={target}
                onClick={() => { setPending(target); setNote(''); setError(null); }}
                title={a.description}
                className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${BTN_STYLE[a.style]}`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          Select an action to continue. Terminal actions cannot be undone.
        </p>
      </div>

      <ConfirmModal
        open={!!pending}
        title={action?.confirmTitle}
        body={action?.confirmBody}
        confirmLabel={action?.label}
        style={action?.style}
        requiresNote={action?.requiresNote}
        note={note}
        onNoteChange={setNote}
        onConfirm={executeTransition}
        onCancel={() => { setPending(null); setNote(''); }}
        loading={loading}
      />
    </>
  );
}
