import React, { useEffect, useRef } from 'react';

const STYLE_CLASSES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  neutral: 'bg-slate-600 hover:bg-slate-700 text-white',
};

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  style = 'primary',
  requiresNote = false,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
  loading = false,
  criticalFlags = [],
  flagAck = false,
  setFlagAck,
}) {
  const noteRef = useRef(null);
  const hasCritical = criticalFlags.length > 0;

  useEffect(() => {
    if (open && requiresNote && noteRef.current) noteRef.current.focus();
  }, [open, requiresNote]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmDisabled = loading
    || (requiresNote && !(note || '').trim())
    || (hasCritical && !flagAck);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
        <h2 id="modal-title" className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{body}</p>

        {/* Critical flag acknowledgment — shown only when dispatching a flagged report */}
        {hasCritical && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-2 items-start">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-red-600 flex-shrink-0 mt-0.5">
                <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6v4M8 12v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  This report has {criticalFlags.length} critical integrity flag{criticalFlags.length > 1 ? 's' : ''}
                </p>
                <ul className="space-y-1">
                  {criticalFlags.map((f, i) => (
                    <li key={i} className="text-xs text-red-700">· {f.label}</li>
                  ))}
                </ul>
              </div>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={flagAck}
                onChange={(e) => setFlagAck(e.target.checked)}
                className="mt-0.5 accent-red-600 flex-shrink-0"
              />
              <span className="text-xs text-red-800 leading-relaxed font-medium">
                I have read all critical flags and I accept responsibility for dispatching this lead.
                I understand that acting on a flagged report without independent corroboration may result in
                wrongful investigation.
              </span>
            </label>
          </div>
        )}

        {requiresNote && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 255))}
              rows={3}
              placeholder="Required — briefly describe the reason or outcome…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <p className="text-right text-xs text-slate-400 mt-0.5">{(note || '').length}/255</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STYLE_CLASSES[style]}`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
