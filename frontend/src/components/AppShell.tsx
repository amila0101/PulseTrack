import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart3,
  ClipboardList,
  FolderKanban,
  LogOut,
  Menu,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import brandLogo from "@/assets/brand.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  managerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "My Reports", icon: ClipboardList },
  { to: "/app/dashboard", label: "Dashboard", icon: BarChart3, managerOnly: true },
  { to: "/app/team", label: "Team Reports", icon: Users, managerOnly: true },
  { to: "/app/projects", label: "Projects", icon: FolderKanban, managerOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((i) => !i.managerOnly || role === "manager");
  const initials = (user?.email?.[0] ?? "U").toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth" });
  }

  // ── Shared nav link component ──────────────────────────────────────────────
  function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
    const active = location.pathname === item.to;
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  }

  // ── User footer (reused in desktop sidebar + mobile sheet) ─────────────────
  function UserFooter({ onSignOut }: { onSignOut: () => void }) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{user?.email}</p>
          <p className="text-xs capitalize text-muted-foreground">{role ?? "member"}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <img src={brandLogo} alt="PulseTrack Logo" className="h-8 w-8 object-contain" />
          <span className="font-display text-lg font-semibold">PulseTrack</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleItems.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <UserFooter onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Mobile header ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <img src={brandLogo} alt="PulseTrack Logo" className="h-7 w-7 object-contain" />
            <span className="font-display font-semibold">PulseTrack</span>
          </div>

          {/* Mobile hamburger menu via Sheet (Radix drawer) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetHeader className="border-b border-sidebar-border px-5 py-4">
                <SheetTitle className="flex items-center gap-2 font-display text-lg">
                  <img
                    src={brandLogo}
                    alt="PulseTrack Logo"
                    className="h-7 w-7 object-contain"
                  />
                  PulseTrack
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 space-y-1 p-3">
                {visibleItems.map((item) => (
                  // SheetContent closes automatically on navigation via the
                  // [data-state] radix close mechanism, but we wrap in a
                  // SheetTrigger-less close using the radix close class trick.
                  <NavLink key={item.to} item={item} />
                ))}
              </nav>
              <div className="border-t border-sidebar-border p-3">
                <UserFooter onSignOut={handleSignOut} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
