import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAgentData, downloadErrorReport, downloadUnifiedForUpload } from '../../services/api';
import { University, UploadResult, AgentUseCase, AGENT_USE_CASES, AGENT_DISPLAY_NAMES, UNIVERSITIES, UNIVERSITY_NAMES, ChangeRecord, ChangeType } from '../../types';
import Button from '../Common/Button';

// ── Unified Validation Review Modal ──────────────────────────────────────────
// Shows ALL errors and ALL proposed auto-corrections in one view.
// If errors exist the user must fix the file; if only corrections exist they
// can confirm all of them at once to proceed with file generation.

interface ValidationReviewModalProps {
  pending: UploadResult;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
}

function ValidationReviewModal({ pending, onConfirm, onCancel, isConfirming }: ValidationReviewModalProps) {
  const hasErrors   = pending.errorRows > 0;
  const tzWarnings  = pending.timezoneWarnings ?? [];
  const ccWarnings  = pending.contactCountryWarnings ?? [];
  const hasChanges  = tzWarnings.length > 0 || ccWarnings.length > 0
    || (pending.dateAutoCorrected ?? 0) > 0
    || (pending.timeAutoCorrected ?? 0) > 0
    || (pending.fromNumberNormalized ?? 0) > 0
    || (pending.countryNameNormalized ?? 0) > 0;

  const canProceed = !hasErrors && hasChanges;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${
            hasErrors ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            {hasErrors ? (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Validation Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasErrors
                ? `${pending.errorRows} row${pending.errorRows === 1 ? '' : 's'} failed validation — fix the source file and re-upload.`
                : 'Review the changes below and confirm to generate the unified file.'}
            </p>
          </div>
          {/* Counts pill row */}
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
              {pending.totalRows} total
            </span>
            {hasErrors && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                {pending.errorRows} error{pending.errorRows === 1 ? '' : 's'}
              </span>
            )}
            {hasChanges && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                {pending.validRows} valid
              </span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* ── Error rows ─────────────────────────────────── */}
          {hasErrors && (
            <section>
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                Validation Errors — must fix before proceeding
              </h3>
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-red-100 whitespace-nowrap">Row #</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-red-100 whitespace-nowrap">User ID</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-red-100">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {pending.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-red-50">
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{err.rowNumber}</td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{err.data['user_id'] || '—'}</td>
                          <td className="px-3 py-2 text-red-700">{err.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ── Auto-applied changes (informational) ────────── */}
          {((pending.dateAutoCorrected ?? 0) > 0 || (pending.timeAutoCorrected ?? 0) > 0
            || (pending.fromNumberNormalized ?? 0) > 0 || (pending.countryNameNormalized ?? 0) > 0) && (
            <section>
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Auto-applied corrections (no confirmation needed)
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
                {(pending.countryNameNormalized ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <strong>{pending.countryNameNormalized}</strong> row{pending.countryNameNormalized === 1 ? '' : 's'}: country name spelling corrected to canonical form (e.g. <span className="font-mono bg-blue-100 px-1 rounded">vietnam</span> → <span className="font-mono bg-blue-100 px-1 rounded">Vietnam</span>)
                  </div>
                )}
                {(pending.fromNumberNormalized ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <strong>{pending.fromNumberNormalized}</strong> row{pending.fromNumberNormalized === 1 ? '' : 's'}: from_number normalised (added leading <span className="font-mono bg-blue-100 px-1 rounded">0</span> for India / <span className="font-mono bg-blue-100 px-1 rounded">+</span> for international)
                  </div>
                )}
                {(pending.dateAutoCorrected ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <strong>{pending.dateAutoCorrected}</strong> row{pending.dateAutoCorrected === 1 ? '' : 's'}: date format normalised to <span className="font-mono bg-blue-100 px-1 rounded">YYYY-MM-DD</span>
                  </div>
                )}
                {(pending.timeAutoCorrected ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <strong>{pending.timeAutoCorrected}</strong> row{pending.timeAutoCorrected === 1 ? '' : 's'}: time format normalised to <span className="font-mono bg-blue-100 px-1 rounded">HH:MM</span> (24-hour)
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Contact-country mismatch (needs confirmation) ── */}
          {ccWarnings.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Contact number country mismatch — will be corrected
              </h3>
              <div className="space-y-2">
                {ccWarnings.map((w, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-orange-900">
                        {w.rowCount} row{w.rowCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="text-gray-500">Contact code suggests</div>
                      <div><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">{w.detectedCountry}</span></div>
                      <div className="text-gray-500">File country</div>
                      <div><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{w.suppliedCountry}</span></div>
                      <div className="text-gray-500">File timezone</div>
                      <div><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{w.suppliedTimezone}</span></div>
                      {w.suggestedTimezone && (
                        <>
                          <div className="text-gray-500 font-medium text-orange-700">Will update to</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{w.detectedCountry}</span>
                            <span className="text-gray-400">+</span>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{w.suggestedTimezone}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Timezone mismatch (needs confirmation) ──────── */}
          {tzWarnings.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timezone mismatch — will be corrected
              </h3>
              <div className="space-y-2">
                {tzWarnings.map((w, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-amber-900">{w.country}</span>
                      <span className="text-xs text-gray-500">{w.rowCount} row{w.rowCount === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{w.suppliedTimezone}</span>
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{w.correctTimezone}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Edge case: no errors, no changes */}
          {!hasErrors && !hasChanges && (
            <p className="text-sm text-gray-500 text-center py-4">No issues found — all rows passed validation.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {hasErrors ? 'Close — fix errors in source file' : 'Cancel'}
          </button>
          {canProceed && (
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isConfirming && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isConfirming ? 'Generating…' : 'Apply Changes & Generate Unified File'}
            </button>
          )}
          {hasErrors && (
            <button
              onClick={() => downloadErrorReport(pending.uploadId)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Error Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Processing Report ─────────────────────────────────────────────────────────
// Shown after a successful file generation. Groups every field change by type
// and renders a colour-coded section per group with a scrollable row table.

const CHANGE_META: Record<ChangeType, { label: string; description: string; color: string; bg: string; border: string; badge: string }> = {
  country_name:    { label: 'Country Name Corrected',     description: 'user_country_of_residence spelling normalised to canonical form',         color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  from_number:     { label: 'From Number Normalised',     description: 'Leading 0 added for India / + prefix added for international numbers',     color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700'   },
  date_format:     { label: 'Date Format Corrected',      description: 'date_of_call reformatted to YYYY-MM-DD',                                   color: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-700'   },
  time_format:     { label: 'Time Format Corrected',      description: 'time_of_call reformatted to HH:MM 24-hour',                                color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700'   },
  timezone:        { label: 'Timezone Corrected',         description: 'timezone updated to canonical IANA value for the destination country',     color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  contact_country: { label: 'Country / TZ from Contact', description: 'user_country_of_residence and timezone updated to match contact number code', color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700'},
  time_converted:  { label: 'Time Converted (IST → Local)', description: 'time_of_call converted from IST to the destination country\'s local timezone', color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700'},
};

const CHANGE_ORDER: ChangeType[] = ['country_name', 'from_number', 'date_format', 'time_format', 'timezone', 'contact_country', 'time_converted'];

interface ProcessingReportProps {
  changes: ChangeRecord[];
  totalRows: number;
}

function ProcessingReport({ changes, totalRows }: ProcessingReportProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (changes.length === 0) return null;

  const grouped = new Map<ChangeType, ChangeRecord[]>();
  for (const c of changes) {
    const list = grouped.get(c.changeType) ?? [];
    list.push(c);
    grouped.set(c.changeType, list);
  }

  const affectedRows = new Set(changes.map((c) => c.rowNumber)).size;

  const toggle = (type: ChangeType) =>
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Report header */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Processing Report
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {changes.length} field change{changes.length === 1 ? '' : 's'} across {affectedRows} of {totalRows} row{totalRows === 1 ? '' : 's'}.
            Click a section to see row-level details.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium shrink-0">
          {grouped.size} change type{grouped.size === 1 ? '' : 's'}
        </span>
      </div>

      {/* Change group sections */}
      <div className="divide-y divide-gray-100">
        {CHANGE_ORDER.filter((t) => grouped.has(t)).map((type) => {
          const records = grouped.get(type)!;
          const meta = CHANGE_META[type];
          const isOpen = !!expanded[type];
          // Deduplicate rows — for contact_country we get 2 records per row (country + tz)
          const uniqueRows = new Set(records.map((r) => r.rowNumber)).size;

          return (
            <div key={type} className={meta.bg}>
              {/* Section header — always visible, clickable to expand */}
              <button
                onClick={() => toggle(type)}
                className={`w-full text-left px-5 py-3 flex items-center gap-3 hover:brightness-95 transition-all`}
              >
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
                  {uniqueRows} row{uniqueRows === 1 ? '' : 's'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-gray-500 truncate">{meta.description}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded detail table */}
              {isOpen && (
                <div className={`border-t ${meta.border} overflow-x-auto max-h-60 overflow-y-auto`}>
                  <table className="min-w-full text-xs">
                    <thead className={`${meta.bg} sticky top-0`}>
                      <tr>
                        <th className={`px-4 py-2 text-left font-semibold text-gray-600 border-b ${meta.border} whitespace-nowrap`}>Row #</th>
                        <th className={`px-4 py-2 text-left font-semibold text-gray-600 border-b ${meta.border} whitespace-nowrap`}>User ID</th>
                        <th className={`px-4 py-2 text-left font-semibold text-gray-600 border-b ${meta.border} whitespace-nowrap`}>Field</th>
                        <th className={`px-4 py-2 text-left font-semibold text-gray-600 border-b ${meta.border}`}>Before</th>
                        <th className={`px-4 py-2 text-left font-semibold text-gray-600 border-b ${meta.border}`}>After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/60">
                      {records.map((r, i) => (
                        <tr key={i} className="hover:bg-white/60">
                          <td className="px-4 py-1.5 text-gray-500 whitespace-nowrap">{r.rowNumber}</td>
                          <td className="px-4 py-1.5 text-gray-500 whitespace-nowrap max-w-[120px] truncate">{r.userId}</td>
                          <td className={`px-4 py-1.5 font-mono whitespace-nowrap ${meta.color}`}>{r.field}</td>
                          <td className="px-4 py-1.5">
                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">{r.oldValue || '(blank)'}</span>
                          </td>
                          <td className="px-4 py-1.5">
                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">{r.newValue}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FileUpload() {
  const { user } = useAuth();

  if (!user || (user.role !== 'system_admin' && user.role !== 'data_manager')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="w-12 h-12 text-red-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-gray-500 font-medium">Access Denied</p>
          <p className="text-gray-400 text-sm mt-1">You don't have permission to upload data.</p>
        </div>
      </div>
    );
  }

  const [university, setUniversity] = useState<University | ''>('');
  const [program, setProgram] = useState('');
  const [agentType, setAgentType] = useState<AgentUseCase | ''>('');
  const [callType, setCallType] = useState<'Live' | 'Test' | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pendingReview, setPendingReview] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const programs = university ? UNIVERSITIES[university] : [];
  const canUpload = university && program && agentType && callType && file && !isUploading;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.(csv|xlsx|xls)$/i.test(dropped.name)) {
      setFile(dropped);
      setResult(null);
      setError('');
    } else {
      setError('Only CSV or Excel (.xlsx, .xls) files are accepted.');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError('');
    }
  };

  // Phase 1: validate the file — always show the review modal if anything needs attention.
  const doUpload = async (confirmCorrections = false, confirmContactCorrections = false) => {
    if (!file || !university || !program || !agentType || !callType) return;
    const isInitial = !confirmCorrections && !confirmContactCorrections;
    if (isInitial) {
      setIsUploading(true);
    } else {
      setIsConfirming(true);
    }
    setError('');

    try {
      const res = await uploadAgentData(file, university, program, agentType, callType, confirmCorrections, confirmContactCorrections);

      const hasErrors  = res.errorRows > 0;
      const hasWarnings = (res.contactCountryWarnings?.length ?? 0) > 0 || (res.timezoneWarnings?.length ?? 0) > 0;
      const hasChanges  = hasWarnings
        || (res.dateAutoCorrected ?? 0) > 0
        || (res.timeAutoCorrected ?? 0) > 0
        || (res.fromNumberNormalized ?? 0) > 0
        || (res.countryNameNormalized ?? 0) > 0;

      // Show the review modal when there's anything to surface (errors or changes),
      // and the file hasn't been generated yet.
      if ((hasErrors || hasChanges) && !res.unifiedCsvAvailable) {
        setPendingReview(res);
        if (!isInitial) {
          // Shouldn't happen (backend should have generated the file), but guard anyway.
          setResult(res);
          setPendingReview(null);
        }
      } else {
        setPendingReview(null);
        setResult(res);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setIsUploading(false);
      setIsConfirming(false);
    }
  };

  const handleUpload = () => {
    setResult(null);
    setPendingReview(null);
    doUpload(false, false);
  };

  // User confirmed all changes — apply everything in one call.
  const handleConfirmAll = () => {
    doUpload(true, true);
  };

  const handleCancelReview = () => {
    setPendingReview(null);
    // If there were errors show the error result; otherwise just dismiss.
    if (pendingReview && pendingReview.errorRows > 0) {
      setResult(pendingReview);
    }
    setPendingReview(null);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPendingReview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {pendingReview && (
        <ValidationReviewModal
          pending={pendingReview}
          onConfirm={handleConfirmAll}
          onCancel={handleCancelReview}
          isConfirming={isConfirming}
        />
      )}
      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* University */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              University <span className="text-red-500">*</span>
            </label>
            <select
              value={university}
              onChange={(e) => {
                setUniversity(e.target.value as University | '');
                setProgram('');
                handleReset();
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select university...</option>
              {(Object.keys(UNIVERSITIES) as University[]).map((u) => (
                <option key={u} value={u}>{UNIVERSITY_NAMES[u]}</option>
              ))}
            </select>
          </div>

          {/* Program — only shown once a university is selected */}
          {university && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Program <span className="text-red-500">*</span>
              </label>
              <select
                value={program}
                onChange={(e) => { setProgram(e.target.value); setAgentType(''); handleReset(); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select program...</option>
                {programs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Agent / Use Case — only shown once a program is selected */}
          {university && program && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Agent / Use Case <span className="text-red-500">*</span>
              </label>
              <select
                value={agentType}
                onChange={(e) => { setAgentType(e.target.value as AgentUseCase | ''); setCallType(''); handleReset(); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select agent...</option>
                {AGENT_USE_CASES.map((a) => (
                  <option key={a} value={a}>{AGENT_DISPLAY_NAMES[a]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Call Type — only shown once an agent is selected */}
          {university && program && agentType && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Call Type <span className="text-red-500">*</span>
              </label>
              <select
                value={callType}
                onChange={(e) => { setCallType(e.target.value as 'Live' | 'Test' | ''); handleReset(); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select call type...</option>
                <option value="Live">Live</option>
                <option value="Test">Test</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : file
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-indigo-300 hover:bg-indigo-50',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-base font-semibold text-gray-700">{file.name}</p>
            <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="text-xs text-red-500 hover:underline mt-1"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-base font-medium text-gray-600">
              Drag & drop your input data file here
            </p>
            <p className="text-sm text-gray-400">or click to browse</p>
            <p className="text-xs text-gray-300 mt-1">CSV or Excel files (.csv, .xlsx, .xls), up to 50MB</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Upload button */}
      {!result && (
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            isLoading={isUploading}
            disabled={!canUpload}
            onClick={handleUpload}
          >
            {isUploading ? 'Uploading...' : 'Upload & Generate Unified File'}
          </Button>
          {!canUpload && !isUploading && (
            <p className="text-sm text-gray-400">
              {!university ? 'Select a university' :
               !program ? 'Select a program' :
               !agentType ? 'Select an agent / use case' :
               !callType ? 'Select a call type' :
               'Select a file to upload'}
            </p>
          )}
        </div>
      )}

      {/* Upload result */}
      {result && (
        <div className="space-y-4">
          {result.success ? (
            <>
              <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">Data uploaded successfully</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    All {result.totalRows} row{result.totalRows === 1 ? '' : 's'} passed validation.
                    {result.unifiedCsvAvailable && ' Unified input file generated.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Upload rejected — please fix errors and re-upload</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {result.errorRows} row{result.errorRows === 1 ? '' : 's'} failed validation.
                  No data was saved.
                </p>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{result.totalRows}</p>
              <p className="text-xs text-gray-500 mt-1">Total Rows</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.validRows}</p>
              <p className="text-xs text-green-600 mt-1">Valid Rows</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${result.errorRows > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-2xl font-bold ${result.errorRows > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                {result.errorRows}
              </p>
              <p className={`text-xs mt-1 ${result.errorRows > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                Error Rows
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {result.errorRows > 0 && (
              <Button
                variant="danger"
                size="md"
                onClick={() => downloadErrorReport(result.uploadId)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Error Report
              </Button>
            )}
            {result.success && result.unifiedCsvAvailable && (
              <Button
                variant="success"
                size="md"
                onClick={async () => {
                  try {
                    await downloadUnifiedForUpload(result.uploadId);
                  } catch (err) {
                    setError((err as Error).message || 'Failed to download unified XLSX.');
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Unified XLSX
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={handleReset}>
              Upload Another File
            </Button>
          </div>

          {/* Processing report — shown only after a successful generation */}
          {result.success && result.unifiedCsvAvailable && (result.changes?.length ?? 0) > 0 && (
            <ProcessingReport changes={result.changes!} totalRows={result.totalRows} />
          )}

          {/* Data preview */}
          {result.data.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h4 className="font-medium text-gray-700 text-sm">
                  Data Preview (first {result.data.length} rows)
                </h4>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-80 scrollbar-thin">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {Object.keys(result.data[0]).map((col) => (
                        <th
                          key={col}
                          className="px-4 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.data.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            className="px-4 py-2 text-gray-600 whitespace-nowrap max-w-[200px] truncate"
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error preview */}
          {result.errors.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-100 bg-red-50">
                <h4 className="font-medium text-red-700 text-sm">
                  Error Details (first {result.errors.length} errors)
                </h4>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-60 scrollbar-thin">
                <table className="min-w-full text-xs">
                  <thead className="bg-red-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-red-100">Row #</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-red-100">Error</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b border-red-100">User ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-red-50">
                        <td className="px-4 py-2 text-gray-600">{err.rowNumber}</td>
                        <td className="px-4 py-2 text-red-600">{err.errorMessage}</td>
                        <td className="px-4 py-2 text-gray-500">{err.data['user_id'] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
