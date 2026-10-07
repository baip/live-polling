import type {
  ControlAction,
  CreatePresentationRequest,
  CreatePresentationResponse,
  JoinResponse,
  RespondResponse,
  StateResponse,
} from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & T;
  if (!res.ok) {
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : res.statusText);
  }
  return data;
}

export const api = {
  createPresentation: (body: CreatePresentationRequest) =>
    request<CreatePresentationResponse>("/api/presentations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  importPresentation: (body: CreatePresentationRequest) =>
    request<CreatePresentationResponse>("/api/presentations/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Which presenter login methods the server has configured. */
  getConfig: () => request<{ passcodeEnabled: boolean; emailEnabled: boolean }>("/api/config"),

  loginPasscode: (passcode: string) =>
    request<{ token: string }>("/api/auth/passcode", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    }),

  requestEmailPin: (email: string) =>
    request<{ ok: true }>("/api/auth/email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyEmailPin: (email: string, code: string) =>
    request<{ token: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  /** URL that downloads the presentation definition as JSON (presenter only). */
  exportUrl: (code: string, presenterKey: string) =>
    `/api/presentations/${code}/export?presenterKey=${encodeURIComponent(presenterKey)}`,

  /** URL that downloads results as a Markdown report (presenter only). */
  resultsMarkdownUrl: (code: string, presenterKey: string) =>
    `/api/presentations/${code}/results.md?presenterKey=${encodeURIComponent(presenterKey)}`,

  join: (code: string, nickname: string) =>
    request<JoinResponse>(`/api/presentations/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname }),
    }),

  getState: (
    code: string,
    opts: { participantId?: string | null; presenterKey?: string | null }
  ) => {
    const params = new URLSearchParams();
    if (opts.participantId) params.set("participantId", opts.participantId);
    if (opts.presenterKey) params.set("presenterKey", opts.presenterKey);
    return request<StateResponse>(`/api/presentations/${code}/state?${params}`);
  },

  respond: (
    code: string,
    body: { participantId: string; questionId: number; value: string | number }
  ) =>
    request<RespondResponse>(`/api/presentations/${code}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  control: (code: string, presenterKey: string, action: ControlAction) =>
    request<{ ok: true }>(`/api/presentations/${code}/control`, {
      method: "POST",
      body: JSON.stringify({ presenterKey, action }),
    }),
};
