/**
 * ReframeX API client — talks to the FastAPI backend via Vite proxy (/api).
 */

export interface Application {
  id: string;
  name: string;
  description: string | null;
  business_domain: string | null;
  owner: string | null;
  technology_stack: string | null;
  environment: string | null;
  assessment_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  artifact_count: number;
}

export interface ApplicationCreate {
  name: string;
  description?: string;
  business_domain?: string;
  owner?: string;
  technology_stack?: string;
  environment?: string;
  assessment_status?: string;
}

export interface ApplicationUpdate {
  name?: string;
  description?: string;
  business_domain?: string;
  owner?: string;
  technology_stack?: string;
  environment?: string;
  assessment_status?: string;
  is_active?: boolean;
}

export interface Artifact {
  id: string;
  application_id: string;
  original_filename: string;
  relative_path: string;
  extension: string | null;
  category: string;
  size_bytes: number;
  upload_timestamp: string;
  processing_status: string;
  sha256: string;
  parse_status: string;
  support_level: string;
  detected_encoding: string;
  fixed_record_length_hint: number | null;
  error_message: string | null;
  detection_reason: string | null;
}

export interface ArtifactSummary {
  total: number;
  by_category: Record<string, number>;
  by_support_level: Record<string, number>;
  by_encoding: Record<string, number>;
  total_size_bytes: number;
}

export interface ArtifactContent {
  id: string;
  original_filename: string;
  relative_path: string;
  category: string;
  size_bytes: number;
  encoding: string;
  content: string | null;
  is_text: boolean;
}

export interface ImportFolderResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface HealthStatus {
  status: string;
  version: string;
  metadata_dir_configured: boolean;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---- Applications ----

export const api = {
  // Health
  health: () => request<HealthStatus>('/api/health'),

  // Applications
  listApplications: () => request<Application[]>('/api/applications'),
  getApplication: (id: string) => request<Application>(`/api/applications/${id}`),
  createApplication: (data: ApplicationCreate) =>
    request<Application>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateApplication: (id: string, data: ApplicationUpdate) =>
    request<Application>(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteApplication: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/applications/${id}`, { method: 'DELETE' }),

  // Artifacts
  listArtifacts: (appId: string) =>
    request<Artifact[]>(`/api/applications/${appId}/artifacts`),
  uploadArtifacts: (appId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return request<Artifact[]>(`/api/applications/${appId}/artifacts`, {
      method: 'POST',
      body: form,
    });
  },
  importFolder: (appId: string) =>
    request<ImportFolderResult>(`/api/applications/${appId}/artifacts/import-folder`, {
      method: 'POST',
    }),
  artifactSummary: (appId: string) =>
    request<ArtifactSummary>(`/api/applications/${appId}/artifacts/summary`),
  getArtifact: (id: string) => request<Artifact>(`/api/artifacts/${id}`),
  getArtifactContent: (id: string) =>
    request<ArtifactContent>(`/api/artifacts/${id}/content`),
  deleteArtifact: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/artifacts/${id}`, { method: 'DELETE' }),
};
