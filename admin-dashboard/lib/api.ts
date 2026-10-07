import { API_URL } from "./config";

const TOKEN_KEY = "busmate_admin_token";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];
  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
  },
  clear() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
  },
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T = unknown>(path: string, options: { method?: Method; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = 60000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(0, aborted ? "TIMEOUT" : "NETWORK", aborted
      ? "The server took too long to respond. Please try again."
      : "Cannot reach the BusMate server. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      tokenStore.clear();
      window.dispatchEvent(new Event("busmate:logout"));
    }
    throw new ApiError(res.status, e.code ?? "ERROR", e.message ?? "Request failed.", e.details);
  }
  return json as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details?.length) return `${err.message} (${err.details.map((d) => `${d.field}: ${d.message}`).join("; ")})`;
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
