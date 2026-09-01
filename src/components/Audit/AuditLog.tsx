import { useEffect, useMemo, useState } from 'react';
import { fetchAuditLog, AuditEvent, AuditEventType } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Audit Log — an append-only feed of every meaningful pipeline event: each
 * agent-data upload, each unified-file generation, each S3 archive, and
 * each scheduler notification.
 *
 * Admin-facing (system_admin + data_manager). Backed by GET /api/data/audit.
 */

const EVENT_LABELS: Record<AuditEventType, string> = {
  upload: 'Upload',
  unified_generated: 'Unified generated',
};

const EVENT_BADGE: Record<AuditEventType, string> = {
  upload: 'bg-blue-50 text-blue-700 border-blue-200',
  unified_generated: 'bg-violet-50 text-violet-700 border-violet-200',
};

const FILTERS: { label: string; value: AuditEventType | '' }[] = [
  { label: 'All events', value: '' },
  { label: 'Uploads', value: 'upload' },
  { label: 'Unified generated', value: 'unified_generated' },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function summarizeDetail(e: AuditEvent): string {
  const d = e.detail || {};
  switch (e.eventType) {
    case 'upload': {
      const t = d.totalRows, v = d.validRows, er = d.errorRows;
      if (t != null) return `${v ?? 0}/${t} rows valid${er ? `, ${er} errors` : ''}`;
      return '';
    }
    case 'unified_generated':
      return d.rows != null ? `${d.rows} rows` : '';
    default:
      return '';
  }
}

export default function AuditLog() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditEventType | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = (eventType: AuditEventType | '') => {
    setLoading(true);
    setError('');
    fetchAuditLog({ eventType: eventType || undefined, limit: 300 })
      .then((res) => setEvents(res.events))
      .catch((err) => {
        setError(
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to load audit log.'
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  if (!user || (user.role !== 'system_admin' && user.role !== 'data_manager')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Access Denied</p>
          <p className="text-sm text-gray-500 mt-1">You do not have permission to view the audit log.</p>
        </div>
      </div>
    );
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.eventType] = (c[e.eventType] || 0) + 1;
    return c;
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-start gap-3">
        <svg className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-indigo-800">Audit Log</h2>
          <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
            A chronological record of every upload and unified-file generation — who did it, when, and the outcome.
          </p>
        </div>
      </div>

      {/* Filter tabs + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => setFilter(f.value)}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                filter === f.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100',
              ].join(' ')}
            >
              {f.label}
              {f.value && counts[f.value] ? ` (${counts[f.value]})` : ''}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(filter)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Events table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">Events</h3>
          <span className="text-xs text-gray-400">{events.length} shown</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-sm font-medium">No audit events yet.</p>
            <p className="text-xs mt-1">Events appear here as data is uploaded and processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">University / Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-gray-50/50 hover:bg-indigo-50/40'}>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmtTime(e.createdAt)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${EVENT_BADGE[e.eventType]}`}>
                        {EVENT_LABELS[e.eventType]}
                      </span>
                      {e.dataType && (
                        <span className="ml-2 text-xs text-gray-400">{e.dataType}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={[
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        e.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                      ].join(' ')}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap text-xs">
                      {e.university || '—'}{e.program ? ` / ${e.program}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs max-w-[200px] truncate" title={e.fileName || ''}>
                      {e.fileName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{e.actorEmail || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[280px] truncate" title={summarizeDetail(e)}>
                      {summarizeDetail(e) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
