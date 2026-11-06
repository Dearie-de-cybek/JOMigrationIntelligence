import { ApiError } from './api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface Pathway {
  id: string;
  code: string;
  destination: 'AUSTRALIA' | 'NEW_ZEALAND' | 'CANADA';
  name: string;
}

export interface Question {
  key: string;
  label: string;
  input: 'number' | 'select' | 'boolean' | 'text';
  options?: string[];
  required: boolean;
}

export interface AssessmentResultView {
  id: string;
  pathway: { code: string; name: string; destination: string };
  status: string;
  engineStatus: string;
  reviewedByStaff: boolean;
  totalPoints: number | null;
  ruleSetVersion: string | null;
  generatedAt: string;
  disclaimers: string[];
  details: {
    passMark: number | null;
    breakdown: { factorId: string; label: string; points: number | null; reason: string }[];
    requirements: { requirementId: string; label: string; state: 'MET' | 'NOT_MET' | 'UNKNOWN'; documents: string[] }[];
    missingInformation: string[];
    explanation: string[];
  };
}

async function call<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { 'x-resume-token': opts.token } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) {
    let message = res.statusText;
    let errors: Record<string, string[]> | undefined;
    try {
      const b = await res.json();
      message = b.message ?? message;
      errors = b.errors;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, errors);
  }
  return res.json();
}

export const assessmentApi = {
  pathways: () => call<Pathway[]>('/pathways'),
  start: (body: unknown) => call<{ assessmentId: string; resumeToken: string }>('/assessments/start', { method: 'POST', body }),
  resume: (token: string) =>
    call<{ id: string; status: string; pathway: Pathway; answers: Record<string, string | number | boolean | null> }>(
      '/assessments/resume',
      { token },
    ),
  questions: (id: string, token: string) =>
    call<{ configured: boolean; questions: Question[] }>(`/assessments/${id}/questions`, { token }),
  getProfile: (id: string, token: string) => call<Record<string, unknown>>(`/assessments/${id}/profile`, { token }),
  saveProfile: (id: string, token: string, body: unknown) =>
    call(`/assessments/${id}/profile`, { method: 'PUT', token, body }),
  saveAnswers: (id: string, token: string, answers: Record<string, unknown>) =>
    call(`/assessments/${id}/answers`, { method: 'PATCH', token, body: { answers } }),
  submit: (id: string, token: string) =>
    call<AssessmentResultView>(`/assessments/${id}/submit`, { method: 'POST', token }),
  result: (id: string, token: string) => call<AssessmentResultView>(`/assessments/${id}/result`, { token }),
};
