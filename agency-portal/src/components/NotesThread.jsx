import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../auth';

const AGENCY_COLORS = {
  KERALA_POLICE: 'text-blue-600',
  EXCISE:        'text-amber-600',
  CYBERDOME:     'text-teal-600',
};
const AGENCY_BAR = {
  KERALA_POLICE: 'bg-blue-400',
  EXCISE:        'bg-amber-400',
  CYBERDOME:     'bg-teal-400',
};

const AGENCY_LABELS = {
  KERALA_POLICE: 'Kerala Police',
  EXCISE:        'Excise Dept.',
  CYBERDOME:     'Cyber Dome',
};

function timeStr(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function NotesThread({ reportId }) {
  const [notes,   setNotes]   = useState([]);
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error,   setError]   = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    apiFetch(`/reports/${reportId}/notes`)
      .then((r) => r?.json())
      .then((d) => { setNotes(d?.notes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reportId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res  = await apiFetch(`/reports/${reportId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text.trim() }),
      });
      const data = await res?.json();
      if (!res?.ok) throw new Error(data?.error || 'Failed to post note.');
      setNotes((n) => [...n, data]);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Notes list */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {loading && (
          <p className="text-sm text-slate-400 animate-pulse">Loading notes…</p>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-sm text-slate-400 italic">
            No internal notes yet. Notes are visible to all agency users on this case.
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="flex gap-3">
            <div className={`w-1 rounded-full flex-shrink-0 mt-1 ${AGENCY_BAR[n.agency] || 'bg-slate-300'}`}
              style={{ minHeight: '1.5rem' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${AGENCY_COLORS[n.agency] || 'text-slate-500'}`}>
                  {AGENCY_LABELS[n.agency] || n.agency}
                </span>
                <span className="text-[10px] text-slate-400">{timeStr(n.created_at)}</span>
              </div>
              <p className="text-sm text-slate-700 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                {n.note}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an internal note — visible to all agency officers…"
          rows={3}
          maxLength={2000}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm
            text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400
            focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400">{text.length}/2000</span>
          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="bg-[#1B6CA8] hover:bg-[#155788] text-white
                text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting ? 'Posting…' : 'Post Note'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
