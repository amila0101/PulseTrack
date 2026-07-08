import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  reportsApi,
  projectsApi,
  profilesApi,
  formatWeekRange,
  weekStart,
  type ReportWithMeta,
} from "@/lib/apiService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  X,
  Eye,
  Calendar,
  Folder,
  Clock,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  FileText,
  User,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/team")({
  component: TeamReports,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusOf(weekIso: string, status: string): "submitted" | "pending" | "late" {
  if (status === "submitted") return "submitted";
  const [y, m, d] = weekIso.split("-").map(Number);
  const weekEnd = new Date(y, m - 1, d + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return new Date() > weekEnd ? "late" : "pending";
}

const THIS_WEEK = weekStart();

// ── Page ──────────────────────────────────────────────────────────────────────

function TeamReports() {
  const { role } = useAuth();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: reportsApi.listAll,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: profilesApi.list });

  // ── Filter state ──────────────────────────────────────────────────────────
  const [member, setMember]           = useState("all");
  const [project, setProject]         = useState("all");
  const [from, setFrom]               = useState("");
  const [to, setTo]                   = useState("");
  const [selectedWeek, setSelectedWeek] = useState(THIS_WEEK);

  // ── Detail modal state ────────────────────────────────────────────────────
  const [viewing, setViewing] = useState<ReportWithMeta | null>(null);

  const hasActiveFilters =
    member !== "all" || project !== "all" || from !== "" || to !== "" || selectedWeek !== THIS_WEEK;

  function clearFilters() {
    setMember("all");
    setProject("all");
    setFrom("");
    setTo("");
    setSelectedWeek(THIS_WEEK);
  }

  const weekOptions = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.week_start_date))).sort((a, b) =>
      b.localeCompare(a),
    );
  }, [reports]);

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (selectedWeek && r.week_start_date !== selectedWeek) return false;
        if (member !== "all" && r.user_id !== member) return false;
        if (project !== "all" && r.project_id !== project) return false;
        if (from && r.week_start_date < from) return false;
        if (to && r.week_start_date > to) return false;
        return true;
      }),
    [reports, member, project, from, to, selectedWeek],
  );

  if (role && role !== "manager") return <Navigate to="/app" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Team Reports</h1>
        <p className="mt-1 text-muted-foreground">
          View, filter, and review all team members' weekly reports.
        </p>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <Card className="p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Week</label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {weekOptions.length === 0 && (
                  <SelectItem value={THIS_WEEK}>This week</SelectItem>
                )}
                {weekOptions.map((w) => (
                  <SelectItem key={w} value={w}>
                    {formatWeekRange(w)}{w === THIS_WEEK ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Member</label>
            <Select value={member} onValueChange={setMember}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
              {reports.length} reports
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {/* ── Results table ───────────────────────────────────────────────────── */}
      <Card className="p-0 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Tasks completed</TableHead>
              <TableHead>Blockers</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {reports.length === 0
                    ? "No reports have been submitted yet."
                    : "No reports match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setViewing(r)}
                >
                  <TableCell className="font-medium">
                    {r.profile?.full_name ?? r.profile?.email ?? "—"}
                  </TableCell>
                  <TableCell>{formatWeekRange(r.week_start_date)}</TableCell>
                  <TableCell>{r.project?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {r.tasks_completed || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View full report"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent double-firing with row click
                        setViewing(r);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Report detail modal ──────────────────────────────────────────────── */}
      <ReportDetailModal report={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

// ── Report detail modal ───────────────────────────────────────────────────────

function ReportDetailModal({
  report,
  onClose,
}: {
  report: ReportWithMeta | null;
  onClose: () => void;
}) {
  if (!report) return null;

  const memberName = report.profile?.full_name ?? report.profile?.email ?? "Unknown member";
  const computedStatus = statusOf(report.week_start_date, report.status);

  return (
    <Dialog open={!!report} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Avatar circle with member initials */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{memberName}</DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {report.profile?.email}
              </p>
            </div>
            <StatusPill status={computedStatus} />
          </div>
        </DialogHeader>

        {/* ── Meta row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-4 text-sm">
          <MetaItem
            icon={Calendar}
            label="Week"
            value={formatWeekRange(report.week_start_date)}
          />
          <MetaItem
            icon={Folder}
            label="Project"
            value={report.project?.name ?? "No project"}
          />
          <MetaItem
            icon={Clock}
            label="Hours worked"
            value={report.hours_worked != null ? `${report.hours_worked}h` : "Not logged"}
          />
        </div>

        {/* ── Field sections ───────────────────────────────────────────────── */}
        <div className="space-y-4 pt-1">
          <ReportSection
            icon={CheckCircle2}
            title="Tasks completed this week"
            content={report.tasks_completed}
            emptyText="No tasks listed."
            iconClass="text-success"
          />

          <ReportSection
            icon={ListTodo}
            title="Tasks planned for next week"
            content={report.tasks_planned}
            emptyText="Nothing planned."
            iconClass="text-primary"
          />

          <ReportSection
            icon={AlertTriangle}
            title="Blockers / Challenges"
            content={report.blockers}
            emptyText="No blockers reported."
            iconClass={
              (report.blockers ?? "").trim() ? "text-warning-foreground" : "text-muted-foreground"
            }
            highlight={!!(report.blockers ?? "").trim()}
          />

          {/* Notes / Links — only render if field exists */}
          {"notes" in report && (
            <ReportSection
              icon={FileText}
              title="Notes / Links"
              content={(report as ReportWithMeta & { notes?: string | null }).notes}
              emptyText="No notes added."
              iconClass="text-muted-foreground"
            />
          )}
        </div>

        {/* ── Footer meta ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Submitted by {memberName}
          </span>
          <span>
            Submitted {new Date(report.created_at).toLocaleDateString(undefined, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-medium leading-snug">{value}</p>
    </div>
  );
}

function ReportSection({
  icon: Icon,
  title,
  content,
  emptyText,
  iconClass,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string | null | undefined;
  emptyText: string;
  iconClass?: string;
  highlight?: boolean;
}) {
  const hasContent = (content ?? "").trim().length > 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass ?? "text-muted-foreground"}`} />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div
        className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
          highlight && hasContent
            ? "border-warning/30 bg-warning/5 text-warning-foreground"
            : "border-border bg-muted/30 text-foreground"
        }`}
      >
        {hasContent ? (
          // Preserve line breaks from textarea input
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <span className="text-muted-foreground">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "submitted" | "pending" | "late" }) {
  const styles = {
    submitted: "bg-success/15 text-success border-success/20",
    pending:   "bg-warning/15 text-warning-foreground border-warning/30",
    late:      "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  return (
    <Badge variant="outline" className={styles[status]}>
      {status}
    </Badge>
  );
}
