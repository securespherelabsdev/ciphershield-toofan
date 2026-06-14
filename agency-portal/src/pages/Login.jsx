import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setSession } from '../auth';

const BANNERS = {
  expired: 'Your session expired. Please sign in again.',
  refresh: 'Sessions do not persist across page refreshes by design. Please sign in again.',
};

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason   = params.get('reason');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch('/api/agency/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'omit',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign in failed.');
      setSession(data.token, data.agency, email.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 flex-shrink-0
        bg-[#1B6CA8] p-10 text-white">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="white"/>
                <path d="M9 12l2 2 4-4" stroke="#1B6CA8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-xl leading-none">CipherShield</p>
              <p className="text-blue-200 text-xs mt-0.5 uppercase tracking-wider">Agency Intelligence Portal</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Operation Toofan</span>
          </div>

          <h2 className="text-2xl font-bold leading-snug mb-3">
            Intelligence intake for Kerala law enforcement.
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed">
            Anonymous civic reports are encrypted at source. Officers see actionable intelligence — never reporter identity.
          </p>
        </div>

        <div className="space-y-4">
          {[
            ['AES-256-GCM encryption', 'All reporter text encrypted at rest'],
            ['Zero PII storage', 'No IPs, devices, or identifiers stored'],
            ['In-memory sessions', 'JWT never persisted to disk or browser storage'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-blue-200 text-xs">{desc}</p>
              </div>
            </div>
          ))}
          <p className="text-blue-300 text-xs pt-2">SecureSphereLabs × Kerala Police · Confidential</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="#1B6CA8"/>
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="font-bold text-slate-900 text-lg">CipherShield</p>
          </div>

          {/* Session banner */}
          {reason && BANNERS[reason] && (
            <div className="mb-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200
              rounded-xl px-4 py-3 text-sm text-amber-800">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="mt-0.5 flex-shrink-0 text-amber-500">
                <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M7.5 5v3M7.5 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {BANNERS[reason]}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-xl font-bold text-slate-900 mb-1">Officer Sign In</h1>
            <p className="text-slate-500 text-sm mb-6">Authorised personnel only. All access is logged.</p>

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-widest">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="officer@kerala.police.gov.in"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm
                    text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400
                    focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-widest">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm
                    text-slate-900 focus:outline-none focus:border-blue-400
                    focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                />
              </div>

              {error && (
                <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-500 mt-0.5 flex-shrink-0">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
                    <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1B6CA8] hover:bg-[#155788] text-white font-semibold py-3 rounded-xl
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Verifying…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="mt-4 bg-white border border-slate-200 rounded-xl px-4 py-3 flex gap-2.5">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-slate-400 mt-0.5 flex-shrink-0">
              <path d="M6.5 1L2 3.5v3c0 2.8 1.87 5.42 4.5 6.06C9.13 11.92 11 9.3 11 6.5V3.5L6.5 1z"
                stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sessions are held in memory only and expire when the tab is closed.
              This is required by the security policy.
            </p>
          </div>

          <p className="text-center text-slate-400 text-xs mt-5">
            Need access?{' '}
            <a href="mailto:ciphershield@securespherelabs.com" className="text-blue-600 hover:underline">
              ciphershield@securespherelabs.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
