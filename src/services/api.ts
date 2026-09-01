import axios from 'axios';
import { UploadResult, UploadRecord, Stats, AgentUseCase } from '../types';

// API base URL — must be set via VITE_API_URL at build time for production.
// Falls back to localhost only for local dev (vite dev server).
const API_BASE_URL: string = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? (() => { throw new Error('VITE_API_URL must be set for production builds'); })()
    : 'http://localhost:3001/api'
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export async function login(email: string, password: string): Promise<{ token: string; user: import('../types').User }> {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

export async function getMe(): Promise<import('../types').User> {
  const res = await api.get('/auth/me');
  return res.data.user;
}

export async function uploadAgentData(
  file: File,
  university: string,
  program: string,
  agentType: AgentUseCase,
  callType: 'Live' | 'Test'
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('university', university);
  formData.append('program', program);
  formData.append('agentType', agentType);
  formData.append('callType', callType);

  const res = await api.post('/upload/agent-data', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/** Fetch the validated data rows stored for a specific agent-data upload. */
export async function fetchUploadRows(uploadId: string): Promise<{ data: Record<string, string>[]; total: number }> {
  const res = await api.get(`/data/upload-rows/${uploadId}`);
  return res.data;
}

export interface AgentMapping {
  agentName: string;
  agentId: string;
}

export async function fetchAgentMapping(): Promise<{ agents: AgentMapping[]; total: number }> {
  const res = await api.get('/data/agent-mapping');
  return res.data;
}

export interface TelephonyProviderRow {
  providerName: string;
  fromNumber: string;
}

export async function fetchTelephonyProviders(): Promise<{ providers: TelephonyProviderRow[]; total: number }> {
  const res = await api.get('/data/telephony-providers');
  return res.data;
}

export async function fetchUploadHistory(filters?: {
  dataType?: string;
  university?: string;
  program?: string;
}): Promise<{ uploads: UploadRecord[]; total: number }> {
  const params: Record<string, string> = {};
  if (filters?.dataType)   params.dataType   = filters.dataType;
  if (filters?.university) params.university = filters.university;
  if (filters?.program)    params.program    = filters.program;
  const res = await api.get('/data/upload-history', { params });
  return res.data;
}

export async function fetchStats(): Promise<Stats> {
  const res = await api.get('/data/stats');
  return res.data;
}

export type AuditEventType =
  | 'upload'
  | 'unified_generated';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  dataType?: AgentUseCase;
  uploadId: string;
  university?: string;
  program?: string;
  fileName?: string;
  actorEmail?: string;
  actorRole?: string;
  status: 'success' | 'failed';
  detail?: Record<string, unknown>;
  createdAt: string;
}

export async function fetchAuditLog(filters?: {
  eventType?: AuditEventType;
  university?: string;
  program?: string;
  limit?: number;
}): Promise<{ events: AuditEvent[]; total: number }> {
  const params: Record<string, string> = {};
  if (filters?.eventType)  params.eventType  = filters.eventType;
  if (filters?.university) params.university = filters.university;
  if (filters?.program)    params.program    = filters.program;
  if (filters?.limit)      params.limit      = String(filters.limit);
  const res = await api.get('/data/audit', { params });
  return res.data;
}

/**
 * Download the per-upload unified Voice AI XLSX for an agent-data upload —
 * date_of_call / time_of_call are stored as Excel number cells (not text
 * strings) so the downstream scheduler can parse them correctly.
 */
export async function downloadUnifiedForUpload(uploadId: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/data/unified-xlsx/${uploadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = 'Failed to download unified file';
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* not JSON, keep default */ }
    throw new Error(msg);
  }

  // Pull filename from Content-Disposition when the server provides one
  let fileName = `unified-voice-ai-${uploadId}.xlsx`;
  const cd = res.headers.get('Content-Disposition');
  const match = cd?.match(/filename="([^"]+)"/);
  if (match) fileName = match[1];

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download the original raw uploaded file (CSV or XLSX) for a given upload.
 * Backend fetches it from Supabase Storage and streams it back with the
 * proper Content-Type / Content-Disposition.
 */
export async function downloadRawFileForUpload(uploadId: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload/raw-file/${uploadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = 'Failed to download raw file';
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* not JSON */ }
    throw new Error(msg);
  }

  let fileName = `raw-upload-${uploadId}`;
  const cd = res.headers.get('Content-Disposition');
  const match = cd?.match(/filename="([^"]+)"/);
  if (match) fileName = match[1];

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadErrorReport(uploadId: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload/error-report/${uploadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Failed to download error report');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `error-report-${uploadId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default api;
