export interface User {
  id: string;
  email: string;
  name: string;
  role: 'system_admin' | 'data_manager' | 'support_agent';
}

export interface UploadResult {
  uploadId: string;
  /**
   * True only when every row passed validation. The backend rejects partial
   * uploads — when success=false, no data was saved and the user must fix
   * the errors and re-upload.
   */
  success: boolean;
  totalRows: number;
  /** Always 0 when success=false (partial saves are disallowed). */
  validRows: number;
  errorRows: number;
  errors: ErrorRow[];
  data: Record<string, string>[];
  /**
   * True when an agent-data upload succeeded and the backend generated a
   * unified Voice AI input XLSX for it. Frontend uses this to decide
   * whether to show the "Download Unified XLSX" button.
   */
  unifiedCsvAvailable?: boolean;
  dateAutoCorrected?: number;
  timeAutoCorrected?: number;
  timezoneAutoCorrected?: number;
}

export interface ErrorRow {
  rowNumber: number;
  data: Record<string, string>;
  errorMessage: string;
}

export type University = 'GGU' | 'Edgewood' | 'ESGCI' | 'Waterloo' | 'ParisBusinessSchool';
export type AgentUseCase =
  | 'live-session-reminder'
  | 'deferral-request'
  | 'missed-assignment-deadline'
  | 'new-program-onboarding'
  | 'deadline-reminder';

export const AGENT_DISPLAY_NAMES: Record<AgentUseCase, string> = {
  'live-session-reminder':    'Live Session Reminder Calling',
  'deferral-request':         'Deferral Request',
  'missed-assignment-deadline': 'Missed Assignment Deadline',
  'new-program-onboarding':   'New Program Onboarding',
  'deadline-reminder':        'Deadline Reminder',
};

export const AGENT_USE_CASES: AgentUseCase[] = [
  'live-session-reminder',
  'deferral-request',
  'missed-assignment-deadline',
  'new-program-onboarding',
  'deadline-reminder',
];

/** Voice AI console agent IDs — mirrors backend AGENT_IDS in constants.ts. */
export const AGENT_IDS: Record<AgentUseCase, string> = {
  'deadline-reminder':          '6a5f3d6e4b06e6a040d16d04',
  'live-session-reminder':      '6a4f8a16008496639b3b25fb',
  'deferral-request':           '6a16dc61ba7c5d66b6c4d21b',
  'missed-assignment-deadline': '6a16d626ba7c5d66b6c4d0c6',
  'new-program-onboarding':     '6a16bd59ba7c5d66b6c4cee9',
};

// user_last_name is intentionally NOT in this list — it's optional (client
// request 2026-07-27). It still stays a top-level unified-output column,
// just not required to have a value.
export const AGENT_MANDATORY_COLUMNS: string[] = [
  'user_id',
  'user_first_name',
  'user_contact',
  'from_number',
  'user_country_of_residence',
  'timezone',
  'date_of_call',
  'time_of_call',
  'reason',
  'agent_id',
];

/** Optional columns common to every agent — merged into user_metadata. */
export const AGENT_OPTIONAL_COLUMNS: string[] = ['Email', 'Program Name', 'Cohort ID'];

/** Top-level unified columns that are optional but NOT merged into metadata. */
export const AGENT_OPTIONAL_TOPLEVEL_COLUMNS: string[] = ['user_last_name'];

/** Telephony provider ↔ from_number lookup — mirrors backend TELEPHONY_PROVIDERS. */
export interface TelephonyProvider {
  providerName: string;
  fromNumber: string;
}

/** Per-agent extra columns — mirrors backend AGENT_SPECIFIC_COLUMNS in constants.ts. */
export const AGENT_SPECIFIC_COLUMNS: Record<AgentUseCase, string[]> = {
  'live-session-reminder': [
    'Course',
    'Session Day',
    'Session Date',
    'Session Start Time',
    'Session End Time',
    'Session Type',
    'Session SME/Professor',
    'Session Topic',
  ],
  'deferral-request': [
    'Name of Course Failed',
    'Next Batch start date',
    'Deferral Fees Percentage',
  ],
  'missed-assignment-deadline': [
    'Assignment Name',
    'Assignment Deadline',
    'Extended Assignment Deadline',
  ],
  'new-program-onboarding': [
    'Orientation Date',
    'Welcome Webinar Date',
    'Batch Launch Date',
    'First Graded Course',
    'First Graded Course Start Date',
    'First Live Session Date',
  ],
  'deadline-reminder': [
    'Course Name',
    'Assignment Name',
    'Assignment Deadline',
  ],
};

/** Every upload is tagged with the agent/use-case it was prepared for. */
export type DataType = AgentUseCase;

export interface UploadRecord {
  uploadId: string;
  fileName: string;
  dataType: DataType;
  university?: University;
  program?: string;
  uploadedAt: string;
  uploadedBy: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  status: 'success' | 'partial' | 'failed';
}

export interface Stats {
  totalUploadsToday: number;
  totalUploads: number;
  totalRowsProcessed: number;
  lastSyncTime: string | null;
}

// Updated 2026-07-29 per client-shared university/program list.
export const UNIVERSITIES: Record<University, string[]> = {
  GGU: ['MBA', 'DBA', 'DBA ET', 'MS Management'],
  Edgewood: ['MBA', 'DBA', 'MBA + DBA Dual', 'EdD', 'MeD', 'EdD + MeD Dual'],
  ESGCI: ['DBA'],
  Waterloo: ['AI-CTO'],
  ParisBusinessSchool: ['MBMT'],
};

export const UNIVERSITY_NAMES: Record<University, string> = {
  GGU: 'Golden Gate University',
  Edgewood: 'Edgewood College',
  ESGCI: 'ESGCI Paris',
  Waterloo: 'Waterloo',
  ParisBusinessSchool: 'Paris Business School',
};

export const ROLE_DISPLAY: Record<User['role'], string> = {
  system_admin: 'System Administrator',
  data_manager: 'Data Manager',
  support_agent: 'Support Agent',
};
