import { supabase } from "@/integrations/supabase/client";

/**
 * Base URL of the FastAPI backend.
 * Reads from VITE_API_BASE_URL env var. In development with the Vite proxy
 * configured, this can be left empty and all /api/* requests proxy automatically.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Request timeout in milliseconds. Prevents hung requests from freezing the UI. */
const REQUEST_TIMEOUT_MS = 10_000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Create a fetch call wrapped with an AbortController timeout.
 * Throws a descriptive error if the request times out or the server returns
 * a non-2xx status code.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  endpoint: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. ` +
          "Check that the FastAPI backend is running.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse an error response body and produce a clean Error.
 * FastAPI returns `{ "detail": "..." }` for validation/auth errors.
 */
async function parseError(response: Response, endpoint: string): Promise<Error> {
  try {
    const body = await response.json();
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : JSON.stringify(body?.detail ?? body);
    return new Error(`[${response.status}] ${detail} (${endpoint})`);
  } catch {
    return new Error(`[${response.status}] ${response.statusText} (${endpoint})`);
  }
}

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      { method: "GET", headers: { "Content-Type": "application/json", ...headers } },
      endpoint,
    );
    if (!response.ok) throw await parseError(response, endpoint);
    return response.json() as Promise<T>;
  },

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      },
      endpoint,
    );
    if (!response.ok) throw await parseError(response, endpoint);
    return response.json() as Promise<T>;
  },

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      },
      endpoint,
    );
    if (!response.ok) throw await parseError(response, endpoint);
    return response.json() as Promise<T>;
  },

  /**
   * DELETE requests follow REST convention: the server returns 204 No Content.
   * We intentionally do NOT call response.json() to avoid a parse error on empty bodies.
   */
  async delete(endpoint: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
      },
      endpoint,
    );
    // 204 No Content is the success response — no body to parse
    if (!response.ok && response.status !== 204) {
      throw await parseError(response, endpoint);
    }
  },
};
