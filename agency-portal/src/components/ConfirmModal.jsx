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
}) {
  const noteRef = useRef(null);

  useEffect(() => {
    if (open && requiresNote && noteRef.current) {
      noteRef.current.focus();
    }
  }, [open, requiresNote]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
        <h2 id="modal-title" className="text-base font-bold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-600">{body}</p>

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
            disabled={loading || (requiresNote && !(note || '').trim())}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STYLE_CLASSES[style]}`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
