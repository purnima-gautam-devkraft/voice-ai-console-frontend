import { useEffect, useMemo, useState } from 'react';
import {
  fetchTelephonyProviders,
  createTelephonyProvider,
  TelephonyProviderRow,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../Common/Button';

const COUNTRY_FLAGS: Record<string, string> = {
  'India': '🇮🇳',
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Singapore': '🇸🇬',
  'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Qatar': '🇶🇦',
  'Kuwait': '🇰🇼',
  'Bahrain': '🇧🇭',
  'Oman': '🇴🇲',
  'Australia': '🇦🇺',
  'Canada': '🇨🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Netherlands': '🇳🇱',
};

const COUNTRY_OPTIONS = Object.keys(COUNTRY_FLAGS);

function flag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🌐';
}

function escapeCSV(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function excelTextCell(v: string): string {
  return `"=""${v.replace(/"/g, '""')}"""`;
}

function downloadProvidersCSV(providers: TelephonyProviderRow[]) {
  const lines = [
    'Provider Name,From Number,Country',
    ...providers.map((p) => `${escapeCSV(p.providerName)},${excelTextCell(p.fromNumber)},${escapeCSV(p.country)}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'telephony-providers.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface AddModalProps {
  onClose: () => void;
  onAdded: (p: TelephonyProviderRow) => void;
}

function AddProviderModal({ onClose, onAdded }: AddModalProps) {
  const [providerName, setProviderName] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [country, setCountry] = useState('');
  const [customCountry, setCustomCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const effectiveCountry = country === '__other__' ? customCountry.trim() : country;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerName.trim() || !fromNumber.trim() || !effectiveCountry) {
      setErr('All fields are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await createTelephonyProvider(providerName.trim(), fromNumber.trim(), effectiveCountry);
      onAdded(res.provider);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add provider.';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Add Telephony Number</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider Name</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g. Twilio, Exotel, Plivo"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Number</label>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="e.g. +12025551234"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code, e.g. +1 for US, +44 for UK</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Country (number origin)</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select country…</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{flag(c)} {c}</option>
              ))}
              <option value="__other__">Other…</option>
            </select>
            {country === '__other__' && (
              <input
                type="text"
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder="Type country name"
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TelephonyProvidersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'system_admin';

  const [providers, setProviders] = useState<TelephonyProviderRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTelephonyProviders()
      .then((res) => { if (!cancelled) setProviders(res.providers); })
      .catch((err) => {
        if (!cancelled) {
          setError(
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Failed to load telephony providers.'
          );
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.providerName.toLowerCase().includes(q) ||
        p.fromNumber.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
    );
  }, [providers, query]);

  return (
    <div className="space-y-6">
      {showAdd && (
        <AddProviderModal
          onClose={() => setShowAdd(false)}
          onAdded={(p) => setProviders((prev) => [...prev, p])}
        />
      )}

      {/* Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
        <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-amber-800">Telephony Provider &amp; From Number Reference</h2>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            Look up the right <span className="font-semibold">from_number</span> when preparing your agent-data upload file.
            Each number is tied to a source country — use a number from the same region as the students being called where possible.
          </p>
          <p className="text-sm text-amber-700 mt-2">
            Use the search box to find by provider, number, or country. Click
            <span className="font-mono bg-amber-100 px-1 mx-1 rounded">Copy</span>
            to copy a from_number to your clipboard.
          </p>
        </div>
      </div>

      {/* Search + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by provider, number, or country…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Number
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={() => downloadProvidersCSV(providers)} disabled={providers.length === 0}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Providers table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">Providers</h3>
          <span className="text-xs text-gray-400">{filtered.length} of {providers.length} shown</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-sm font-medium">No providers match your search.</p>
            <p className="text-xs mt-1">Try a different keyword.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Provider Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Country (Origin)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">from_number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 border-b border-gray-200"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p, i) => (
                  <tr key={p.id ?? p.providerName} className={i % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-gray-50/50 hover:bg-indigo-50/40'}>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{p.providerName}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-base leading-none">{flag(p.country)}</span>
                        <span className="text-sm">{p.country}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">{p.fromNumber}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigator.clipboard.writeText(p.fromNumber)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                          title="Copy from_number"
                        >
                          Copy
                        </button>
                      </div>
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
