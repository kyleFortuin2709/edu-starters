import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin";
import { SiteLayout } from "@/components/SiteLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    const admin = await isAdmin(data.user.id);
    if (!admin) throw redirect({ to: "/dashboard" });
    return { adminUser: data.user };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/universities", label: "Universities & faculties", exact: false },
  { to: "/admin/courses", label: "Courses", exact: false },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          EduStarter admin
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </div>
    </SiteLayout>
  );
}
