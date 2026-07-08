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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { projectsApi, reportsApi, type Project } from "@/lib/apiService";

export const Route = createFileRoute("/_authenticated/app/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  // Bug Fix #5: load all reports so we can count per-project usage
  const { data: allReports = [] } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: reportsApi.listAll,
  });

  const reportCountByProject = allReports.reduce<Record<string, number>>((acc, r) => {
    if (r.project_id) acc[r.project_id] = (acc[r.project_id] ?? 0) + 1;
    return acc;
  }, {});

  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);

  // Bug Fix #2: check report count before deleting
  const del = useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Project deleted");
    },
    onError: (e) =>
      toast.error(
        `Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      ),
  });

  function handleDelete(p: Project) {
    const linked = reportCountByProject[p.id] ?? 0;
    const warning =
      linked > 0
        ? `\n\n⚠️  This project has ${linked} report${linked !== 1 ? "s" : ""} linked to it.\nThose reports will become unassigned if you continue.`
        : "";
    if (confirm(`Delete project "${p.name}"?${warning}`)) {
      del.mutate(p.id);
    }
  }

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEditing(null);
  }

  if (role && role !== "manager") return <Navigate to="/app" replace />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage the projects your team reports against.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (!o) handleClose();
            else setOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          </DialogTrigger>

          {/* Bug Fix #1: key forces full remount so form always resets correctly */}
          <ProjectDialog
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={handleClose}
          />
        </Dialog>
      </div>

      <Card className="p-0 shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              {/* Bug Fix #5: report usage count column */}
              <TableHead className="text-center">Reports</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Bug Fix #3: loading spinner while data fetches */}
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No projects yet. Click "New project" to add your first one.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => {
                const count = reportCountByProject[p.id] ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="max-w-sm text-muted-foreground">
                      {p.description || "—"}
                    </TableCell>
                    {/* Bug Fix #5: show linked report count */}
                    <TableCell className="text-center">
                      {count > 0 ? (
                        <Badge variant="secondary">{count}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit project"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete project"
                        disabled={del.isPending}
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Bug Fix #4 note: "Assign team members" is marked optional in spec — not yet implemented */}
    </div>
  );
}

// ── Project dialog / form ─────────────────────────────────────────────────────

function ProjectDialog({
  editing,
  onClose,
}: {
  editing: Project | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Bug Fix #1: because of the `key` prop on this component, useState always
  // initialises with the correct value — no stale data from previous edits.
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [nameError, setNameError] = useState("");

  function validate() {
    if (!name.trim()) {
      setNameError("Project name is required.");
      return false;
    }
    if (name.trim().length > 255) {
      setNameError("Name must be 255 characters or fewer.");
      return false;
    }
    setNameError("");
    return true;
  }

  const save = useMutation({
    mutationFn: () =>
      editing
        ? projectsApi.update(editing.id, {
            name: name.trim(),
            description: description.trim() || undefined,
          })
        : projectsApi.create({
            name: name.trim(),
            description: description.trim() || undefined,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(editing ? "Project updated ✓" : "Project created ✓");
      onClose();
    },
    onError: (e) =>
      toast.error(
        `Save failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      ),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
      </DialogHeader>

      <form
        className="space-y-4 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (validate()) save.mutate();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="pn">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pn"
            value={name}
            placeholder="e.g. Client A, Internal Tooling, R&D"
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            className={nameError ? "border-destructive" : ""}
          />
          {nameError && (
            <p className="text-xs text-destructive">{nameError}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="pd">Description (optional)</Label>
          <Textarea
            id="pd"
            rows={3}
            value={description}
            placeholder="What does this project cover?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Info note about the optional "assign members" feature */}
        <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <span>
            Team members can tag any report with this project. Per-project member
            assignment is not required — all members see all projects.
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
