import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAgentData, downloadErrorReport, downloadUnifiedForUpload } from '../../services/api';
import { University, UploadResult, AgentUseCase, AGENT_USE_CASES, AGENT_DISPLAY_NAMES, UNIVERSITIES, UNIVERSITY_NAMES, TimezoneWarning } from '../../types';
import Button from '../Common/Button';

interface TimezoneConfirmModalProps {
  warnings: TimezoneWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}

function TimezoneConfirmModal({ warnings, onConfirm, onCancel }: TimezoneConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Timezone Mismatch Found</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              The following rows have a timezone that doesn't match the expected value for the destination country.
              Confirm to auto-correct and generate the unified file.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
          {warnings.map((w, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="font-medium text-gray-800">{w.country}</span>
                <span className="text-xs text-gray-500">{w.rowCount} row{w.rowCount === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-amber-800">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{w.suppliedTimezone}</span>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{w.correctTimezone}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel — fix source file
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
          >
            Fix & Generate Unified File
          </button>
        </div>
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
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [timezoneWarnings, setTimezoneWarnings] = useState<TimezoneWarning[] | null>(null);
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

  const doUpload = async (confirmCorrections = false) => {
    if (!file || !university || !program || !agentType || !callType) return;
    setIsUploading(true);
    setError('');
    setResult(null);
    setTimezoneWarnings(null);

    try {
      const res = await uploadAgentData(file, university, program, agentType, callType, confirmCorrections);
      // If backend returned timezone warnings and hasn't generated the unified file yet, show modal
      if (res.timezoneWarnings && res.timezoneWarnings.length > 0 && !res.unifiedCsvAvailable) {
        setTimezoneWarnings(res.timezoneWarnings);
      } else {
        setResult(res);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = () => doUpload(false);
  const handleConfirmCorrections = () => {
    setTimezoneWarnings(null);
    doUpload(true);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setTimezoneWarnings(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {timezoneWarnings && timezoneWarnings.length > 0 && (
        <TimezoneConfirmModal
          warnings={timezoneWarnings}
          onConfirm={handleConfirmCorrections}
          onCancel={() => setTimezoneWarnings(null)}
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
              {((result.dateAutoCorrected ?? 0) > 0 || (result.timeAutoCorrected ?? 0) > 0) && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Date / time formats auto-corrected in unified file</p>
                    <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                      {(result.dateAutoCorrected ?? 0) > 0 && (
                        <li>
                          {result.dateAutoCorrected} row{result.dateAutoCorrected === 1 ? '' : 's'}: date normalised to <strong>YYYY-MM-DD</strong>
                        </li>
                      )}
                      {(result.timeAutoCorrected ?? 0) > 0 && (
                        <li>
                          {result.timeAutoCorrected} row{result.timeAutoCorrected === 1 ? '' : 's'}: time normalised to <strong>HH:MM</strong> (24-hour)
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
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
