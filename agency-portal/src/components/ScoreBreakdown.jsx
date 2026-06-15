import React, { useState } from 'react';

// Human-readable metadata for each breakdown signal
const SIGNAL_META = {
  confidence: {
    label: 'Reporter confidence',
    explain: 'How certain the reporter claims to be. "I witnessed directly" = 35 pts; "fairly certain" = 20; "suspicion" = 5. Self-reported — cannot be verified, but inconsistencies are flagged separately.',
  },
  report_type_specificity: {
    label: 'Report type specificity',
    explain: 'Specific types (Sale, Manufacturing, Transportation, Storage) score +5. Vague types ("Suspicious Person", "Other") score 0 — they are harder to route to field officers.',
  },
  district: {
    label: 'District provided',
    explain: 'A district is required to route the lead. +8 if present. Reports without a district can only be reviewed manually.',
  },
  area_quality: {
    label: 'Area description quality',
    explain: 'Scored on word count AND uniqueness ratio. 8+ words with ≥65% unique = 12 pts. 4+ words with ≥50% unique = 6 pts. Pure character length is not rewarded — a reporter cannot game this by repeating text.',
  },
  details_quality: {
    label: 'Details quality',
    explain: 'Same word-quality scoring as area description, on a larger scale. 25+ unique-rich words = 12 pts. Repetitive or sparse text scores 0–3. Gibberish is flagged separately.',
  },
  gps: {
    label: 'GPS location',
    explain: 'Voluntarily shared pin-drop. +15 if coordinates match the declared district. +12 if no district was provided to validate against. −10 if GPS is outside the declared district. −15 if GPS is outside Kerala entirely.',
  },
  recency: {
    label: 'Recency of event',
    explain: '"Today" = +8, "Yesterday" = +5, "Within past week" = +2, "More than a week ago" = −3. Stale intelligence is penalised rather than treated neutrally.',
  },
  consistency: {
    label: 'Confidence / time consistency',
    explain: '"Witnessed directly" + same-day/yesterday report = +5 (credible pattern). "Witnessed directly" + more than a week ago = −10 (eyewitnesses typically report immediately). No effect otherwise.',
  },
  harassment_signal: {
    label: 'Named individual check',
    explain: 'Detects whether the report names a specific person. If named with no location context (no GPS, <5 words area) = −15 and a CRITICAL flag. Named with context = 0 pts but a MEDIUM flag. Anonymous targeting is the most common misuse of this platform.',
  },
  corroboration: {
    label: 'Independent corroboration',
    explain: 'Count of other reports with the same district + type in the past 7 days. ≥5 = +20; ≥2 = +10. Corroboration is zeroed out if a duplicate cluster is detected (same text resubmitted to fake corroboration).',
  },
  burst_penalty: {
    label: 'Burst submission check',
    explain: '5+ reports in the same district within a 10-minute window triggers a −20 burst penalty. This is the primary defence against coordinated submission attacks where one actor creates fake corroboration by submitting multiple reports rapidly.',
  },
};

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-600 text-white', icon: '🔴', label: 'CRITICAL' },
  high:     { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', badge: 'bg-orange-500 text-white', icon: '🟠', label: 'HIGH' },
  medium:   { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-400 text-white', icon: '🟡', label: 'MEDIUM' },
  low:      { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-400 text-white', icon: '⚪', label: 'LOW' },
};

function PtsBadge({ pts }) {
  if (pts === 0) return <span className="text-xs font-mono text-slate-400">±0</span>;
  const positive = pts > 0;
  return (
    <span className={`text-xs font-mono font-bold ${positive ? 'text-green-700' : 'text-red-600'}`}>
      {positive ? '+' : ''}{pts}
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 70 ? '#2563EB' : score >= 40 ? '#D97706' : '#DC2626';
  const label = score >= 70 ? 'DISPATCH' : score >= 40 ? 'REVIEW' : 'QUARANTINE';
  const labelColor = score >= 70 ? 'text-blue-700' : score >= 40 ? 'text-amber-700' : 'text-red-700';
  const labelBg   = score >= 70 ? 'bg-blue-50 border-blue-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, background: color }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>0 — Quarantine</span>
          <span>40 — Review</span>
          <span>70 — Dispatch</span>
          <span>100</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-3xl font-black text-slate-900">{score}</span>
        <span className="text-slate-400 text-sm">/100</span>
        <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 px-2 py-0.5 rounded border ${labelColor} ${labelBg}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

function SignalRow({ signal, pts }) {
  const [open, setOpen] = useState(false);
  const meta = SIGNAL_META[signal];
  if (!meta) return null;
  const isPositive = pts > 0;
  const isNegative = pts < 0;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-2.5 px-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-4 flex-shrink-0">
          {isPositive && <span className="text-green-500 text-xs">▲</span>}
          {isNegative && <span className="text-red-500 text-xs">▼</span>}
          {!isPositive && !isNegative && <span className="text-slate-300 text-xs">—</span>}
        </div>
        <span className="flex-1 text-sm text-slate-700">{meta.label}</span>
        <PtsBadge pts={pts} />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-slate-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 ml-7">
          <p className="text-xs text-slate-500 leading-relaxed">{meta.explain}</p>
        </div>
      )}
    </div>
  );
}

function FlagCard({ flag }) {
  const [open, setOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low;

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.border} ${cfg.bg}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left`}
      >
        <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className={`text-xs font-semibold ${cfg.text}`}>{flag.label}</span>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-slate-400 flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className={`px-4 pb-4 space-y-3 border-t ${cfg.border}`}>
          <p className={`text-xs leading-relaxed mt-3 ${cfg.text}`}>{flag.detail}</p>
          {flag.officer_action && (
            <div className="bg-white/70 border border-current/10 rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Officer Guidance</p>
              <p className={`text-xs leading-relaxed font-medium ${cfg.text}`}>{flag.officer_action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OfficerSummary({ flags }) {
  if (!flags || flags.length === 0) return null;
  const hasCritical = flags.some((f) => f.severity === 'critical');
  const hasHigh     = flags.some((f) => f.severity === 'high');

  if (hasCritical) {
    return (
      <div className="bg-red-700 text-white rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <path d="M9 2L1 16h16L9 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 7v4M9 13v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div>
          <p className="text-sm font-bold mb-0.5">Do not dispatch without officer review</p>
          <p className="text-xs text-red-200 leading-relaxed">
            This report has one or more CRITICAL flags. Dispatching may result in wasted field resources or — in the case of harassment reports — wrongful investigation of an innocent individual.
            Read all flags, add internal notes, and confirm independently before taking action.
          </p>
        </div>
      </div>
    );
  }

  if (hasHigh) {
    return (
      <div className="bg-orange-600 text-white rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.5"/>
          <path d="M9 5.5v4M9 11.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div>
          <p className="text-sm font-bold mb-0.5">Review carefully before dispatching</p>
          <p className="text-xs text-orange-100 leading-relaxed">
            This report has HIGH severity flags. These may indicate inconsistencies, stale data, or potential misuse.
            Review all flag details before deciding whether to dispatch.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function ScoreBreakdown({ scoreFlags, score }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!scoreFlags) {
    return (
      <div className="text-xs text-slate-400 italic">
        Score breakdown not available for this report (submitted before v2 engine).
      </div>
    );
  }

  const { breakdown = {}, flags = [] } = scoreFlags;
  const criticalCount = flags.filter((f) => f.severity === 'critical').length;
  const highCount     = flags.filter((f) => f.severity === 'high').length;

  // Ordered signals for display
  const SIGNAL_ORDER = [
    'confidence', 'report_type_specificity', 'district',
    'area_quality', 'details_quality', 'gps',
    'recency', 'consistency', 'harassment_signal',
    'corroboration', 'burst_penalty',
  ];

  return (
    <div className="space-y-4">
      {/* Score bar */}
      <ScoreBar score={score} />

      {/* Officer guidance banner */}
      <OfficerSummary flags={flags} />

      {/* Flags */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Integrity Flags
            </p>
            <span className="text-[10px] text-slate-400">
              ({flags.length} detected
              {criticalCount > 0 && `, ${criticalCount} critical`}
              {highCount > 0 && `, ${highCount} high`})
            </span>
          </div>
          {flags.map((f, i) => <FlagCard key={i} flag={f} />)}
        </div>
      )}

      {flags.length === 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-600 flex-shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-xs text-green-700 font-medium">No integrity flags detected on this report.</p>
        </div>
      )}

      {/* Score breakdown table (collapsible) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowBreakdown((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Score Breakdown
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Click each signal to learn more</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`text-slate-400 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </button>
        {showBreakdown && (
          <div className="border-t border-slate-100">
            {SIGNAL_ORDER.map((key) => (
              breakdown[key] !== undefined
                ? <SignalRow key={key} signal={key} pts={breakdown[key]} />
                : null
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Total Score</span>
              <span className="text-sm font-black text-slate-900">{score} / 100</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
