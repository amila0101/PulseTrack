import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { reportsApi, profilesApi, weekStart, formatWeekRange } from "@/lib/apiService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  component: Dashboard,
});

// ── Brand palette — used consistently across all charts ──────────────────────
const COLORS = [
  "oklch(0.55 0.18 260)",
  "oklch(0.70 0.14 195)",
  "oklch(0.68 0.16 155)",
  "oklch(0.75 0.15 60)",
  "oklch(0.65 0.22 20)",
  "oklch(0.60 0.19 300)",
];

const AXIS_COLOR  = "oklch(0.52 0.03 255)";
const GRID_COLOR  = "oklch(0.92 0.01 250)";
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: `1px solid ${GRID_COLOR}`,
  fontSize: 12,
};

// ── Page ──────────────────────────────────────────────────────────────────────

function Dashboard() {
  const { role } = useAuth();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: reportsApi.listAll,
  });
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: profilesApi.list,
  });

  if (role && role !== "manager") return <Navigate to="/app" replace />;

  const isLoading = reportsLoading || profilesLoading;

  // ── Metric calculations ──────────────────────────────────────────────────
  const currentWeek = weekStart();
  const thisWeekReports = reports.filter((r) => r.week_start_date === currentWeek);

  // Members = all profiles except the viewing manager (subtract 1)
  const memberCount = Math.max(profiles.length - 1, 0);

  // Unique member IDs who submitted this week
  const submittedMemberIds = new Set(
    thisWeekReports.filter((r) => r.status === "submitted").map((r) => r.user_id),
  );
  const submittedCount   = submittedMemberIds.size;
  const pendingCount     = thisWeekReports.filter((r) => r.status === "pending").length;

  // Bug Fix #1: compliance = submitted members / total members (capped at 100%)
  const compliance =
    memberCount > 0
      ? Math.min(Math.round((submittedCount / memberCount) * 100), 100)
      : 0;

  const openBlockers = reports.filter((r) => (r.blockers ?? "").trim().length > 0).length;
  const totalHours   = reports.reduce((s, r) => s + Number(r.hours_worked ?? 0), 0);

  // ── Chart data ───────────────────────────────────────────────────────────

  // 1. Tasks completed trend — last 8 weeks (team-wide report count with completed tasks)
  const trendData = useMemo(() => {
    const map = new Map<string, { submitted: number; pending: number }>();
    reports.forEach((r) => {
      const cur = map.get(r.week_start_date) ?? { submitted: 0, pending: 0 };
      if (r.status === "submitted") cur.submitted += 1;
      else cur.pending += 1;
      map.set(r.week_start_date, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, v]) => ({
        week: week.slice(5), // "MM-DD"
        submitted: v.submitted,
        pending: v.pending,
      }));
  }, [reports]);

  // 2. Bug Fix #2: Submission status per team member (for current week)
  const memberStatusData = useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]));
    // Map each profile to their submission status this week
    return profiles
      .filter((p) => {
        // Exclude the manager — we don't want them in the member chart
        const memberReport = thisWeekReports.find((r) => r.user_id === p.id);
        return memberReport !== undefined || true; // show all, even non-submitters
      })
      .map((p) => {
        const memberReport = thisWeekReports.find((r) => r.user_id === p.id);
        return {
          name: (p.full_name ?? p.email ?? "—").split(" ")[0], // first name only for chart
          fullName: p.full_name ?? p.email ?? "—",
          status: memberReport?.status ?? "not submitted",
          submitted: memberReport?.status === "submitted" ? 1 : 0,
          pending:   memberReport?.status === "pending"   ? 1 : 0,
          missing:   !memberReport ? 1 : 0,
        };
      });
  }, [profiles, thisWeekReports]);

  // 3. Workload by project (hours)
  const workloadData = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach((r) => {
      const key = r.project?.name ?? "Unassigned";
      map.set(key, (map.get(key) ?? 0) + Number(r.hours_worked ?? 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  // 4. Bug Fix #3: Recent activity feed — last 8 reports across the team
  const recentReports = useMemo(
    () =>
      [...reports]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8),
    [reports],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Team Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Live view across your team's weekly reports.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex h-[104px] items-center justify-center p-5 shadow-soft">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CheckCircle2}
            label="Submitted this week"
            value={`${submittedCount} / ${memberCount}`}
            sub={`${pendingCount} pending`}
            tone="success"
          />
          {/* Bug Fix #1: correct compliance = submitted÷members, capped at 100% */}
          <StatCard
            icon={Users}
            label="Compliance rate"
            value={`${compliance}%`}
            sub={`${memberCount} team members`}
            tone="primary"
          />
          <StatCard
            icon={AlertTriangle}
            label="Open blockers"
            value={openBlockers}
            sub="across all reports"
            tone="warning"
          />
          <StatCard
            icon={TrendingUp}
            label="Total hours logged"
            value={totalHours}
            sub="all-time"
            tone="accent"
          />
        </div>
      )}

      {/* ── Charts row 1 ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chart 1: Tasks completed trend */}
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Report submissions trend</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Submitted vs pending reports per week (last 8 weeks).
          </p>
          <div className="h-72">
            {trendData.length === 0 ? (
              <EmptyChart message="No report data yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="week" stroke={AXIS_COLOR} fontSize={12} />
                  <YAxis stroke={AXIS_COLOR} fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted"
                    stroke={COLORS[0]}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    name="Pending"
                    stroke={COLORS[3]}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Chart 2 (Bug Fix #2): Submission status by team member — this week */}
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Submission status by member</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Who has submitted a report for the current week.
          </p>
          <div className="h-72">
            {memberStatusData.length === 0 ? (
              <EmptyChart message="No team members found." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberStatusData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" stroke={AXIS_COLOR} fontSize={12} allowDecimals={false} domain={[0, 1]} hide />
                  <YAxis type="category" dataKey="name" stroke={AXIS_COLOR} fontSize={12} width={72} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(_val, name, props) => [props.payload.status, "Status"]}
                    labelFormatter={(label) => {
                      const item = memberStatusData.find((d) => d.name === label);
                      return item?.fullName ?? label;
                    }}
                  />
                  <Bar dataKey="submitted" name="Submitted" stackId="a" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="pending"   name="Pending"   stackId="a" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="missing"   name="Not submitted" stackId="a" fill={GRID_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Legend for the status bar chart */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[2] }} />
              Submitted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[3] }} />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: GRID_COLOR }} />
              Not submitted
            </span>
          </div>
        </Card>
      </div>

      {/* ── Charts row 2 ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chart 3: Workload by project */}
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Workload by project</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Total hours logged per project (all-time).
          </p>
          <div className="h-72">
            {workloadData.length === 0 ? (
              <EmptyChart message="No hours logged yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workloadData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {workloadData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(val) => [`${val}h`, "Hours"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Bug Fix #3: Recent activity feed */}
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Recent activity</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            The 8 most recently submitted reports.
          </p>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentReports.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No reports yet.
            </div>
          ) : (
            <ul className="space-y-3 overflow-y-auto" style={{ maxHeight: "17rem" }}>
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.profile?.full_name ?? r.profile?.email ?? "Unknown member"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatWeekRange(r.week_start_date)}
                      {r.project?.name ? ` · ${r.project.name}` : ""}
                    </p>
                    {(r.tasks_completed ?? "").trim() && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {r.tasks_completed}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <StatusPill status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone: "success" | "warning" | "primary" | "accent";
}) {
  const tones = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    primary: "bg-primary/10 text-primary",
    accent:  "bg-accent/20 text-accent-foreground",
  };
  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

// Bug Fix #4: empty state for charts
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-success/15 text-success border-success/20",
    pending:   "bg-warning/15 text-warning-foreground border-warning/30",
  };
  return (
    <Badge variant="outline" className={styles[status] ?? "bg-muted text-muted-foreground"}>
      {status}
    </Badge>
  );
}
