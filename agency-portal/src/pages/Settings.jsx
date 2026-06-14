import React, { useState } from 'react';
import { apiFetch, getEmail } from '../auth';

export default function Settings() {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (next.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }

    setLoading(true);
    try {
      const res  = await apiFetch('/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res?.json();
      if (!res?.ok) throw new Error(data?.error || 'Password change failed.');
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const email = getEmail();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Account and security settings</p>
      </div>

      {/* Account info */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Account</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Signed in as</p>
          <p className="text-sm text-slate-800">{email || '—'}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Current password
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              New password
            </label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1">Minimum 12 characters.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          {success && (
            <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              Password updated successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#1B6CA8] hover:bg-[#155788] text-white font-semibold py-2.5 px-5 rounded-lg
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="flex gap-2.5 text-xs text-slate-500">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="mt-0.5 flex-shrink-0">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M6.5 4v3M6.5 8.5v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        <p>
          Passwords are hashed with bcrypt before storage.
          The server never sees or stores your plaintext password.
        </p>
      </div>
    </div>
  );
}
