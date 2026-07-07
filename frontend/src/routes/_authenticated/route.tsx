import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { ChatWidget } from "@/components/ChatWidget";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, role } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <AppShell>
      <Outlet />
      {role === "manager" && <ChatWidget />}
    </AppShell>
  );
}
