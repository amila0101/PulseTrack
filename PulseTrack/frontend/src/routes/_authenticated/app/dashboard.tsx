import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, profilesApi, weekStart } from "@/lib/apiService";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  component: Dashboard,
});

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const OKLCH_COLORS = [
  "oklch(0.55 0.18 260)",
  "oklch(0.7 0.14 195)",
  "oklch(0.68 0.16 155)",
  "oklch(0.75 0.15 60)",
  "oklch(0.65 0.22 20)",
];

function Dashboard() {
  const { role } = useAuth();

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: reportsApi.listAll,
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: profilesApi.list });

  if (role && role !== "manager") return <Navigate to="/app" replace />;

  const currentWeek = weekStart();
  const thisWeekReports = reports.filter((r) => r.week_start_date === currentWeek);
  const submittedThisWeek = thisWeekReports.length;
  const compliance =
    profiles.length > 0
      ? Math.round((new Set(thisWeekReports.map((r) => r.user_id)).size / profiles.length) * 100)
      : 0;
  const openBlockers = reports.filter((r) => (r.blockers ?? "").trim().length > 0).length;

  // Trend: tasks completed (proxy = report count with tasks) per week, last 8 weeks
  const trendMap = new Map<string, { hours: number; reports: number }>();
  reports.forEach((r) => {
    const key = r.week_start_date;
    const cur = trendMap.get(key) ?? { hours: 0, reports: 0 };
    cur.hours += Number(r.hours_worked ?? 0);
    if ((r.tasks_completed ?? "").trim()) cur.reports += 1;
    trendMap.set(key, cur);
  });
  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, v]) => ({ week: week.slice(5), completed: v.reports, hours: v.hours }));

  // Workload by project
  const projMap = new Map<string, number>();
  reports.forEach((r) => {
    const key = r.project?.name ?? "Unassigned";
    projMap.set(key, (projMap.get(key) ?? 0) + Number(r.hours_worked ?? 0));
  });
  const workloadData = Array.from(projMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Team Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Live view across your team's weekly reports.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Reports this week"
          value={submittedThisWeek}
          tone="success"
        />
        <StatCard
          icon={Users}
          label="Compliance rate"
          value={`${compliance}%`}
          sub={`${profiles.length} team members`}
          tone="primary"
        />
        <StatCard icon={AlertTriangle} label="Open blockers" value={openBlockers} tone="warning" />
        <StatCard
          icon={TrendingUp}
          label="Total hours (all-time)"
          value={reports.reduce((s, r) => s + Number(r.hours_worked ?? 0), 0)}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Tasks completed trend</h3>
          <p className="mb-4 text-sm text-muted-foreground">Weekly reports with completed tasks.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="week" stroke="oklch(0.52 0.03 255)" fontSize={12} />
                <YAxis stroke="oklch(0.52 0.03 255)" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.01 250)" }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="oklch(0.36 0.14 260)"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold">Workload by project</h3>
          <p className="mb-4 text-sm text-muted-foreground">Total hours logged per project.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={workloadData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {workloadData.map((_, i) => (
                    <Cell key={i} fill={OKLCH_COLORS[i % OKLCH_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

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
    accent: "bg-accent/20 text-accent-foreground",
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
