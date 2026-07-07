/**
 * apiService.ts — Single source of truth for all data access.
 *
 * All Supabase (Lovable Cloud) calls are wrapped here so the backend can be
 * swapped later (e.g. Python / FastAPI) without touching UI components.
 */
import { supabase } from "@/integrations/supabase/client";

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
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface ReportWithMeta extends Report {
  project?: Pick<Project, "id" | "name"> | null;
  profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
}

/* ---------------- Auth ---------------- */
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
  async getMyRole(): Promise<AppRole> {
    const { data, error } = await supabase.rpc("get_my_role");
    if (error || !data) return "member";
    return data as AppRole;
  },
};

/* ---------------- Profiles ---------------- */
export const profilesApi = {
  async list(): Promise<Profile[]> {
    const { data, error } = await supabase.from("profiles").select("id, email, full_name");
    if (error) throw error;
    return data ?? [];
  },
  async me(): Promise<Profile | null> {
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sess.user.id)
      .maybeSingle();
    return data ?? null;
  },
};

/* ---------------- Projects ---------------- */
export const projectsApi = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase.from("projects").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
  async create(input: { name: string; description?: string }) {
    const { data, error } = await supabase.from("projects").insert(input).select().single();
    if (error) throw error;
    return data;
  },
  async update(id: string, input: { name?: string; description?: string }) {
    const { data, error } = await supabase
      .from("projects")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------------- Reports ---------------- */
export interface ReportInput {
  project_id: string | null;
  week_start_date: string;
  tasks_completed: string;
  tasks_planned: string;
  blockers: string;
  hours_worked: number;
  status?: ReportStatus;
}

export const reportsApi = {
  async listMine(): Promise<ReportWithMeta[]> {
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) return [];
    const { data, error } = await supabase
      .from("reports")
      .select("*, project:projects(id,name)")
      .eq("user_id", sess.user.id)
      .order("week_start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ReportWithMeta[];
  },
  async listAll(): Promise<ReportWithMeta[]> {
    const [{ data, error }, profiles] = await Promise.all([
      supabase
        .from("reports")
        .select("*, project:projects(id,name)")
        .order("week_start_date", { ascending: false }),
      profilesApi.list(),
    ]);
    if (error) throw error;
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return (data ?? []).map((r) => ({
      ...r,
      profile: byId.get(r.user_id) ?? null,
    })) as ReportWithMeta[];
  },
  async create(input: ReportInput) {
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("reports")
      .insert({ ...input, user_id: sess.user.id, status: input.status ?? "submitted" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, input: Partial<ReportInput>) {
    const { data, error } = await supabase
      .from("reports")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------------- Chat (mock — swap for LangChain backend later) ---------------- */
export const chatApi = {
  async ask(question: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 700));
    const q = question.toLowerCase();
    if (q.includes("blocker"))
      return "Based on this week's reports, the top blockers involve API rate limits on the Mobile App project and pending design review on the Marketing Website.";
    if (q.includes("design"))
      return "The Design team shipped 12 components to the Design System, unblocked the Marketing Website hero, and started work on dark-mode tokens.";
    if (q.includes("hours") || q.includes("workload"))
      return "Total logged hours this week: 218h. Highest workload: Mobile App (86h), followed by Design System (72h).";
    return "I'm a demo assistant right now. Connect your LangChain/LLM backend to /api/chat to get real answers about your team's weekly reports.";
  },
};

/* ---------------- Helpers ---------------- */
export function weekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function formatWeekRange(isoDate: string): string {
  const start = new Date(isoDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}
