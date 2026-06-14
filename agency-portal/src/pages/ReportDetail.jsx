import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth';
import ConfidenceBadge from '../components/ConfidenceBadge';
import StatusUpdater from '../components/StatusUpdater';
import AuditHistory from '../components/AuditHistory';
import NotesThread from '../components/NotesThread';
import AssignmentPanel from '../components/AssignmentPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { STATUS_LABEL, isTerminal } from '../workflow';

const DEPT_COLORS = {
  KERALA_POLICE: 'text-blue-700 bg-blue-50 border-blue-200',
  EXCISE:        'text-amber-700 bg-amber-50 border-amber-200',
  CYBERDOME:     'text-teal-700 bg-teal-50 border-teal-200',
};
const DEPT_LABELS = {
  KERALA_POLICE: 'Kerala Police',
  EXCISE:        'Excise Dept.',
  CYBERDOME:     'Cyber Dome',
};

function Field({ label, value, wide, mono }) {
  if (!value) return null;
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm leading-relaxed ${mono ? 'font-mono text-slate-500' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h2>
        {badge}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function AiSection({ report }) {
  const { ai_summary, status } = report;
  if (ai_summary) {
    return (
      <SectionCard title="Automated Analysis"
        badge={<span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Generated at dispatch</span>}>
        <div className="space-y-4">
          {ai_summary.summary && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{ai_summary.summary}</p>
            </div>
          )}
          {ai_summary.key_indicators?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Key Indicators</p>
              <ul className="space-y-1.5">
                {ai_summary.key_indicators.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2.5 items-start">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">·</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ai_summary.suggested_action && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Suggested Action</p>
              <p className="text-sm text-slate-700">{ai_summary.suggested_action}</p>
            </div>
          )}
          {ai_summary.confidence_note && (
            <p className="text-xs text-slate-500 italic">{ai_summary.confidence_note}</p>
          )}
        </div>
      </SectionCard>
    );
  }
  if (status === 'REVIEW' || status === 'QUARANTINE') {
    return (
      <SectionCard title="Automated Analysis">
        <div className="flex gap-3 items-center">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M7 4.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Generates automatically at dispatch</p>
            <p className="text-xs text-slate-400 mt-0.5">
              An AI intelligence briefing is produced when this lead is dispatched to field officers.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Automated Analysis">
      <p className="text-sm text-slate-400 italic">Analysis was not available at the time of dispatch.</p>
    </SectionCard>
  );
}

export default function ReportDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [report,     setReport]     = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [error,      setError]      = useState(null);

  const load = useCallback(() => {
    apiFetch(`/reports/${id}`)
      .then((r) => r?.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setReport(d);
        setAssignment(d.assigned_to || null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleStatusUpdate(newStatus, note) {
    setReport((r) => ({ ...r, status: newStatus, outcome_note: note || r.outcome_note }));
  }

  if (error) return (
    <div className="max-w-3xl space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        Back
      </button>
      <p className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</p>
    </div>
  );

  if (!report) return (
    <div className="max-w-3xl">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded-xl w-1/3" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );

  const terminal = isTerminal(report.status);
  const deptColor = DEPT_COLORS[assignment] || '';
  const deptLabel = DEPT_LABELS[assignment];

  const receivedDate = new Date(report.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="max-w-3xl space-y-4">

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Back to Lead Queue
      </button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{report.report_type}</h1>
            <p className="font-mono text-[11px] text-slate-400 mt-0.5">{report.id}</p>
          </div>
          <ConfidenceBadge status={report.status} score={report.fp_score} />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-xs text-slate-500">
            Status: <span className="text-slate-800 font-medium">{STATUS_LABEL[report.status]}</span>
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500">
            District: <span className="text-slate-800 font-medium">{report.district || 'Unspecified'}</span>
          </span>
          {assignment && (
            <>
              <span className="text-slate-300">·</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${deptColor}`}>
                {deptLabel}
              </span>
            </>
          )}
        </div>

        {terminal && report.outcome_note && (
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Outcome Note</p>
            <p className="text-sm text-slate-700">{report.outcome_note}</p>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: main content (3/5) */}
        <div className="lg:col-span-3 space-y-4">

          <SectionCard title="Case Details">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Confidence Score"    value={`${report.fp_score} / 100`} />
              <Field label="Time Observed"       value={report.time_observed} />
              <Field label="Reporter Confidence" value={report.confidence_raw} />
              <Field label="Received"            value={receivedDate} />
              {report.area_desc && <Field label="General Area" value={report.area_desc} wide />}
              {report.geo_location && (
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">GPS Location</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <code className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono">
                      {report.geo_location.lat}, {report.geo_location.lng}
                    </code>
                    <a
                      href={`https://maps.google.com/?q=${report.geo_location.lat},${report.geo_location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Open in Maps →
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Voluntarily shared by reporter. Encrypted at rest.</p>
                </div>
              )}
            </div>
          </SectionCard>

          {report.details && (
            <SectionCard title="Reporter Details">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{report.details}</p>
              <p className="text-[10px] text-slate-400 mt-3">
                Raw unedited text from the anonymous reporter.
              </p>
            </SectionCard>
          )}

          <ErrorBoundary title="Could not load automated analysis">
            <AiSection report={report} />
          </ErrorBoundary>

          <SectionCard title="Internal Notes">
            <ErrorBoundary title="Could not load notes">
              <NotesThread reportId={report.id} />
            </ErrorBoundary>
          </SectionCard>
        </div>

        {/* Right: actions panel (2/5) */}
        <div className="lg:col-span-2 space-y-4">

          <SectionCard title="Assign to Department">
            <AssignmentPanel
              reportId={report.id}
              current={assignment}
              onChange={setAssignment}
            />
          </SectionCard>

          {!terminal ? (
            <SectionCard title="Update Status">
              <StatusUpdater
                reportId={report.id}
                currentStatus={report.status}
                onUpdate={handleStatusUpdate}
              />
            </SectionCard>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Case Closed</p>
              <p className="text-xs text-slate-500">
                This case has reached a terminal state ({STATUS_LABEL[report.status]}) and cannot be transitioned further.
              </p>
            </div>
          )}

          <SectionCard title="Case Timeline">
            <ErrorBoundary title="Could not load history">
              <AuditHistory reportId={report.id} />
            </ErrorBoundary>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
