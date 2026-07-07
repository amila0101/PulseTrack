import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { reportsApi, projectsApi, profilesApi, formatWeekRange } from "@/lib/apiService";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/team")({
  component: TeamReports,
});

function TeamReports() {
  const { role } = useAuth();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: reportsApi.listAll,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: profilesApi.list });

  const [member, setMember] = useState("all");
  const [project, setProject] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (member !== "all" && r.user_id !== member) return false;
        if (project !== "all" && r.project_id !== project) return false;
        if (from && r.week_start_date < from) return false;
        if (to && r.week_start_date > to) return false;
        return true;
      }),
    [reports, member, project, from, to],
  );

  if (role && role !== "manager") return <Navigate to="/app" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Team Reports</h1>
        <p className="mt-1 text-muted-foreground">All submitted reports across the team.</p>
      </div>

      <Card className="p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Member</label>
            <Select value={member} onValueChange={setMember}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-0 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Blockers</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No reports match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.profile?.full_name ?? r.profile?.email ?? "—"}
                  </TableCell>
                  <TableCell>{formatWeekRange(r.week_start_date)}</TableCell>
                  <TableCell>{r.project?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.tasks_completed ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {(r.blockers ?? "").trim() ? (
                      <span className="text-warning-foreground">{r.blockers}</span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>{r.hours_worked ?? 0}h</TableCell>
                  <TableCell>
                    <StatusPill status={statusOf(r.week_start_date, r.status)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function statusOf(week: string, status: string): "submitted" | "pending" | "late" {
  if (status === "submitted") {
    const w = new Date(week);
    const now = new Date();
    const diffDays = (now.getTime() - w.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 10) return "late";
    return "submitted";
  }
  return "pending";
}

function StatusPill({ status }: { status: "submitted" | "pending" | "late" }) {
  const styles = {
    submitted: "bg-success/15 text-success border-success/20",
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    late: "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  return (
    <Badge variant="outline" className={styles[status]}>
      {status}
    </Badge>
  );
}
