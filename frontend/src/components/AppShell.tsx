import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BarChart3, ClipboardList, FolderKanban, LogOut, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import brandLogo from "@/assets/brand.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  managerOnly?: boolean;
}

const items: NavItem[] = [
  { to: "/app", label: "My Reports", icon: ClipboardList },
  { to: "/app/dashboard", label: "Dashboard", icon: BarChart3, managerOnly: true },
  { to: "/app/team", label: "Team Reports", icon: Users, managerOnly: true },
  { to: "/app/projects", label: "Projects", icon: FolderKanban, managerOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visible = items.filter((i) => !i.managerOnly || role === "manager");
  const initials = (user?.email?.[0] ?? "U").toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <img src={brandLogo} alt="PulseTrack Logo" className="h-8 w-8 object-contain" />
          <span className="font-display text-lg font-semibold">PulseTrack</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visible.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.email}</p>
              <p className="text-xs capitalize text-muted-foreground">{role ?? "member"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <img src={brandLogo} alt="PulseTrack Logo" className="h-8 w-8 object-contain" />
            <span className="font-display font-semibold">PulseTrack</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
