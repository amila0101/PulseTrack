/**
 * apiService.ts — Single source of truth for all data access.
 *
 * All data operations go through the FastAPI backend (/api/*).
 * The Supabase client is used ONLY for authentication (sign in / sign up / sign out).
 * No direct Supabase table queries are made from the frontend.
 */
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "./apiClient";

// ── Types ────────────────────────────────────────────────────────────────────

export type AppRole = "member" | "manager";
export type ReportStatus = "submitted" | "pending";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  project_id: string | null;
  week_start_date: string; // YYYY-MM-DD
  tasks_completed: string | null;
  tasks_planned: string | null;
  blockers: string | null;
  hours_worked: number | null;
  notes: string | null;        // optional notes or links
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface ReportWithMeta extends Report {
  project?: Pick<Project, "id" | "name"> | null;
  profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
// These methods use the Supabase Auth SDK directly (correct — auth is Supabase's domain).
// All other data operations go through the FastAPI backend.

export const authApi = {
  async signUp(email: string, password: string, fullName: string) {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Fetches the user's role from the FastAPI backend (source of truth for RBAC). */
  async getMyRole(): Promise<AppRole> {
    try {
      const response = await apiClient.get<{ role: AppRole }>("/api/users/me/role");
      return response.role;
    } catch {
      // Fallback to "member" — ensures the app remains functional even if
      // the backend is temporarily unreachable during development.
      return "member";
    }
  },
};

// ── Profiles ──────────────────────────────────────────────────────────────────

export const profilesApi = {
  /**
   * [Manager only] Returns all team member profiles.
   * Calls the FastAPI GET /api/users/team endpoint, which enforces the
   * manager role check server-side.
   */
  async list(): Promise<Profile[]> {
    try {
      return await apiClient.get<Profile[]>("/api/users/team");
    } catch {
      // Non-managers will get a 403; return an empty array so the UI degrades
      // gracefully rather than crashing.
      return [];
    }
  },

  /** Returns the currently authenticated user's own profile. */
  async me(): Promise<Profile | null> {
    try {
      return await apiClient.get<Profile>("/api/users/me");
    } catch {
      return null;
    }
  },
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const projectsApi = {
  async list(): Promise<Project[]> {
    return apiClient.get<Project[]>("/api/projects");
  },

  async create(input: { name: string; description?: string }) {
    return apiClient.post<Project>("/api/projects", input);
  },

  async update(id: string, input: { name?: string; description?: string }) {
    return apiClient.put<Project>(`/api/projects/${id}`, input);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/projects/${id}`);
  },
};

// ── Reports ───────────────────────────────────────────────────────────────────

export interface ReportInput {
  project_id: string | null;
  week_start_date: string;
  tasks_completed: string;
  tasks_planned: string;
  blockers: string;
  hours_worked: number;
  notes?: string | null;       // optional notes or links
  status?: ReportStatus;
}

export const reportsApi = {
  async listMine(): Promise<ReportWithMeta[]> {
    return apiClient.get<ReportWithMeta[]>("/api/reports?all_reports=false");
  },

  async listAll(): Promise<ReportWithMeta[]> {
    return apiClient.get<ReportWithMeta[]>("/api/reports?all_reports=true");
  },

  async create(input: ReportInput) {
    return apiClient.post<Report>("/api/reports", input);
  },

  async update(id: string, input: Partial<ReportInput>) {
    return apiClient.put<Report>(`/api/reports/${id}`, input);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/reports/${id}`);
  },
};

// ── Chat ─────────────────────────────────────────────────────────────────────
/**
 * Sends a question (plus the conversation history for multi-turn context)
 * to the real FastAPI backend at POST /api/chat.
 *
 * The backend:
 *   1. Pulls the last N weeks of real report data from Supabase.
 *   2. Injects that data into a system prompt.
 *   3. Calls the configured LLM (Gemini / OpenAI) and returns the answer.
 *
 * Falls back to keyword matching against REAL data when no LLM key is set
 * — so answers are always grounded in actual database content, never fiction.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatApi = {
  async ask(
    question: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    const res = await apiClient.post<{ answer: string }>("/api/chat", {
      question,
      history,
    });
    return res.answer;
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday that starts the
 * current calendar week. Sunday is treated as the last day of the previous
 * week (ISO 8601 standard).
 *
 * Examples:
 *  - Tuesday  2024-01-09 → "2024-01-08"  (this Monday)
 *  - Sunday   2024-01-14 → "2024-01-08"  (the Monday 6 days ago)
 *  - Monday   2024-01-08 → "2024-01-08"  (same day)
 */
export function weekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday … 6 = Saturday
  // Shift to Monday: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats a week start ISO date as a human-readable range.
 * e.g. "Jan 8 – Jan 14, 2024"
 */
export function formatWeekRange(isoDate: string): string {
  // Parse as local date to avoid UTC off-by-one on date-only strings
  const [year, month, day] = isoDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}
