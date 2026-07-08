import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  projectsApi,
  reportsApi,
  weekStart,
  formatWeekRange,
  type ReportWithMeta,
} from "@/lib/apiService";

export const Route = createFileRoute("/_authenticated/app/")(({
  component: MyReportsPage,
}));

// ── Bug Fix #3: Show loading spinner while role is resolving ──────────────────
function MyReportsPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Managers land on dashboard — only redirect once role is confirmed
  if (role === "manager") return <Navigate to="/app/dashboard" replace />;
  return <MemberReports />;
}

// ── Default empty form factory — used on open AND after reset ─────────────────
function emptyForm(projects: { id: string; name: string }[]) {
  return {
    project_id: projects[0]?.id ?? "",
    week_start_date: weekStart(),
    tasks_completed: "",
    tasks_planned: "",
    blockers: "",
    hours_worked: 0 as number,
    notes: "",
    status: "submitted" as "submitted" | "pending",
  };
}

function MemberReports() {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "mine"],
    queryFn: reportsApi.listMine,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const [editing, setEditing] = useState<ReportWithMeta | null>(null);
  const [open, setOpen] = useState(false);

  // ── Bug Fix #5: delete now has a proper error handler ──────────────────────
  const del = useMutation({
    mutationFn: reportsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted");
    },
    onError: (e) =>
      toast.error(
        `Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      ),
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(r: ReportWithMeta) {
    setEditing(r);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEditing(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">My Weekly Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Log what you shipped, planned, and any blockers.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New report
            </Button>
          </DialogTrigger>

          {/* ── Bug Fix #2: key forces full remount when editing changes ────── */}
          <ReportDialog
            key={editing?.id ?? "new"}
            projects={projects}
            editing={editing}
            onClose={handleClose}
          />
        </Dialog>
      </div>

      <Card className="p-0 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No reports yet. Click "New report" to submit your first one.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {formatWeekRange(r.week_start_date)}
                  </TableCell>
                  <TableCell>
                    {r.project?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{r.hours_worked ?? 0}h</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit report"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete report"
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm("Delete this report? This cannot be undone."))
                          del.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "bg-success/15 text-success border-success/20",
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

// ── Report dialog / form ──────────────────────────────────────────────────────

function ReportDialog({
  projects,
  editing,
  onClose,
}: {
  projects: { id: string; name: string }[];
  editing: ReportWithMeta | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // ── Bug Fix #2: initialise from `editing` if editing, else a fresh form ────
  // The `key` prop on this component (set in MemberReports) guarantees a full
  // remount whenever editing changes, so useState always gets the right value.
  const [form, setForm] = useState(() =>
    editing
      ? {
          project_id: editing.project_id ?? "",
          week_start_date: editing.week_start_date,
          tasks_completed: editing.tasks_completed ?? "",
          tasks_planned: editing.tasks_planned ?? "",
          blockers: editing.blockers ?? "",
          hours_worked: editing.hours_worked ?? 0,
          notes: (editing as ReportWithMeta & { notes?: string }).notes ?? "",
          status: editing.status,
        }
      : emptyForm(projects),
  );

  // Keep project_id in sync if projects load AFTER the dialog opens (async race)
  useEffect(() => {
    if (!editing && !form.project_id && projects.length > 0) {
      setForm((prev) => ({ ...prev, project_id: projects[0].id }));
    }
  }, [projects, editing, form.project_id]);

  // ── Bug Fix #4: client-side validation ────────────────────────────────────
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  function validate() {
    const errs: Partial<Record<string, string>> = {};
    if (!form.week_start_date) errs.week_start_date = "Week is required.";
    if (!form.tasks_completed?.trim())
      errs.tasks_completed = "Please describe what you completed this week.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        project_id:
          form.project_id === "__none__" || form.project_id === ""
            ? null
            : form.project_id,
        hours_worked: Number(form.hours_worked) || 0,
        notes: form.notes?.trim() || null,
      };
      if (editing) return reportsApi.update(editing.id, payload);
      return reportsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success(editing ? "Report updated ✓" : "Report submitted ✓");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit report" : "New weekly report"}</DialogTitle>
      </DialogHeader>

      <form
        className="grid gap-5 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (validate()) save.mutate();
        }}
      >
        {/* Row 1: Week + Project */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="wk">
              Week starting (Monday) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wk"
              type="date"
              value={form.week_start_date}
              onChange={(e) =>
                setForm({ ...form, week_start_date: e.target.value })
              }
            />
            {errors.week_start_date && (
              <p className="text-xs text-destructive">{errors.week_start_date}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Project / Category</Label>
            <Select
              value={form.project_id || "__none__"}
              onValueChange={(v) =>
                setForm({ ...form, project_id: v === "__none__" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No project —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tasks completed */}
        <div className="space-y-1">
          <Label htmlFor="done">
            Tasks completed this week <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="done"
            rows={3}
            value={form.tasks_completed}
            onChange={(e) => setForm({ ...form, tasks_completed: e.target.value })}
            placeholder="What did you ship or finish?"
            className={errors.tasks_completed ? "border-destructive" : ""}
          />
          {errors.tasks_completed && (
            <p className="text-xs text-destructive">{errors.tasks_completed}</p>
          )}
        </div>

        {/* Tasks planned */}
        <div className="space-y-1">
          <Label htmlFor="plan">Tasks planned for next week</Label>
          <Textarea
            id="plan"
            rows={3}
            value={form.tasks_planned}
            onChange={(e) => setForm({ ...form, tasks_planned: e.target.value })}
            placeholder="What are you planning to work on next week?"
          />
        </div>

        {/* Blockers */}
        <div className="space-y-1">
          <Label htmlFor="bl">Blockers / Challenges</Label>
          <Textarea
            id="bl"
            rows={2}
            value={form.blockers}
            onChange={(e) => setForm({ ...form, blockers: e.target.value })}
            placeholder="Anything slowing you down or blocking progress?"
          />
        </div>

        {/* Row: Hours + Status */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="h">Hours worked (optional)</Label>
            <Input
              id="h"
              type="number"
              min={0}
              max={168}
              step={0.5}
              value={form.hours_worked}
              onChange={(e) =>
                setForm({ ...form, hours_worked: Number(e.target.value) })
              }
              placeholder="e.g. 40"
            />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm({ ...form, status: v as "submitted" | "pending" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="pending">Save as draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bug Fix #1: Notes / Links field — was completely missing */}
        <div className="space-y-1">
          <Label htmlFor="notes">Notes / Links (optional)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any links, PRs, docs, or additional context…"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Submit report"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
