import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { DesktopNav, MobileNav } from "./nav-links";
import LogoutButton from "./logout-button";
import { getInitials } from "@/lib/format";
import { MICRO, tone } from "@/lib/ui";

// Admin and student workspaces are separate folders, so the navigation points
// at real pages instead of in-page anchors. Scanner access is granted per event
// through public.attendance_scanners, so the entry only appears for accounts an
// administrator assigned.
function getNavigation(isAdmin, canScan) {
  if (isAdmin) {
    return [
      { href: "/admin", label: "Overview", icon: "grid" },
      { href: "/admin/events", label: "Events", icon: "calendar" },
      { href: "/admin/attendance", label: "Attendance", icon: "chart" },
      { href: "/admin/accounts", label: "Accounts", icon: "users" },
      { href: "/admin/files", label: "Files", icon: "folder" },
      { href: "/admin/updates", label: "Updates", icon: "megaphone" },
    ];
  }

  const items = [
    { href: "/dashboard", label: "Overview", icon: "grid" },
    { href: "/events", label: "Events", icon: "calendar" },
  ];

  if (canScan) {
    items.push({ href: "/scanner", label: "Scanner", icon: "scan" });
  }

  items.push(
    { href: "/dashboard/files", label: "My files", icon: "folder" },
    { href: "/dashboard/updates", label: "Updates", icon: "megaphone" },
  );

  return items;
}

export function DashboardShell({ profile, user, canScan = false, children }) {
  const isAdmin = profile.role === "admin";
  const navigation = getNavigation(isAdmin, canScan);
  const displayName = profile.full_name || user.email?.split("@")[0] || "Student";
  const homeHref = isAdmin ? "/admin" : "/dashboard";
  const initials = getInitials(profile.full_name, user.email);
  const accent = tone(isAdmin ? "indigo" : "blue");
  const roleLabel = isAdmin ? "Administrator" : "Student";

  return (
    <div className="min-h-screen text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-blue-800 focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-slate-200/70 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-5">
          <Brand href={homeHref} showTagline />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className={`px-3 ${MICRO}`}>{isAdmin ? "Administration" : "My workspace"}</p>
          <div className="mt-2">
            <DesktopNav items={navigation} />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${accent.soft}`}
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-slate-800">
                {displayName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
                {profile.email || user.email}
              </span>
            </span>
          </div>
          <div className="mt-1">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8 xl:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Brand href={homeHref} />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className={MICRO}>NextGen portal</p>
                <p className="mt-1 truncate text-[13.5px] font-semibold text-slate-700">
                  {isAdmin ? "Administration workspace" : "Student workspace"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] sm:inline-flex ${accent.soft}`}
              >
                <Icon name={isAdmin ? "shield" : "school"} className="h-3.5 w-3.5" strokeWidth={2} />
                {roleLabel}
              </span>
              <span
                className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold sm:h-10 sm:w-10 ${accent.soft}`}
                title={`${displayName} · ${roleLabel}`}
              >
                {initials}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500"
                />
              </span>
              <LogoutButton compact />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="px-4 pb-32 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-14 xl:px-10"
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200/70 bg-white/95 px-1.5 py-1.5 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <MobileNav items={navigation} />
        </div>
      </nav>
    </div>
  );
}