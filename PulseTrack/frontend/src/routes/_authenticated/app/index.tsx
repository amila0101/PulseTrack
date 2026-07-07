import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  projectsApi,
  reportsApi,
  weekStart,
  formatWeekRange,
  type ReportWithMeta,
} from "@/lib/apiService";

export const Route = createFileRoute("/_authenticated/app/")({
  component: MyReportsPage,
});

function MyReportsPage() {
  const { role } = useAuth();
  // Managers land on dashboard by default
  if (role === "manager") return <Navigate to="/app/dashboard" replace />;
  return <MemberReports />;
}

function MemberReports() {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "mine"],
    queryFn: reportsApi.listMine,
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const [editing, setEditing] = useState<ReportWithMeta | null>(null);
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: reportsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted");
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">My Weekly Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Log what you shipped, planned, and any blockers.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New report
            </Button>
          </DialogTrigger>
          <ReportDialog
            projects={projects}
            editing={editing}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
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
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this report?")) del.mutate(r.id);
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
  const [form, setForm] = useState({
    project_id: editing?.project_id ?? projects[0]?.id ?? "",
    week_start_date: editing?.week_start_date ?? weekStart(),
    tasks_completed: editing?.tasks_completed ?? "",
    tasks_planned: editing?.tasks_planned ?? "",
    blockers: editing?.blockers ?? "",
    hours_worked: editing?.hours_worked ?? 0,
    status: editing?.status ?? ("submitted" as const),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, hours_worked: Number(form.hours_worked) || 0 };
      if (editing) return reportsApi.update(editing.id, payload);
      return reportsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success(editing ? "Report updated" : "Report submitted");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit report" : "New weekly report"}</DialogTitle>
      </DialogHeader>
      <form
        className="grid gap-4 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="wk">Week starting (Monday)</Label>
            <Input
              id="wk"
              type="date"
              value={form.week_start_date}
              onChange={(e) => setForm({ ...form, week_start_date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Project</Label>
            <Select
              value={form.project_id}
              onValueChange={(v) => setForm({ ...form, project_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="done">Tasks completed this week</Label>
          <Textarea
            id="done"
            rows={3}
            value={form.tasks_completed}
            onChange={(e) => setForm({ ...form, tasks_completed: e.target.value })}
            placeholder="What did you ship?"
          />
        </div>
        <div>
          <Label htmlFor="plan">Tasks planned for next week</Label>
          <Textarea
            id="plan"
            rows={3}
            value={form.tasks_planned}
            onChange={(e) => setForm({ ...form, tasks_planned: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="bl">Blockers</Label>
          <Textarea
            id="bl"
            rows={2}
            value={form.blockers}
            onChange={(e) => setForm({ ...form, blockers: e.target.value })}
            placeholder="Anything slowing you down?"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="h">Hours worked</Label>
            <Input
              id="h"
              type="number"
              min={0}
              step={0.5}
              value={form.hours_worked}
              onChange={(e) => setForm({ ...form, hours_worked: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as "submitted" | "pending" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {editing ? "Save changes" : "Submit report"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
