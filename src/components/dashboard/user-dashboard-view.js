import Link from "next/link";
import AnnouncementList from "./announcement-list";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Icon } from "@/components/ui/icon";
import { BTN_MD, BTN_OUTLINE, BTN_PRIMARY, MICRO, PANEL_LG, TITLE_LG } from "@/lib/ui";
import { getGreeting } from "@/lib/dashboard-data";
import { formatDate, getFirstName } from "@/lib/format";

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3.5 first:pt-0 last:border-0 last:pb-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
        <Icon name={icon} className="h-4.5 w-4.5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value || "Not provided"}</p>
      </div>
    </div>
  );
}

export default function UserDashboardView({
  profile,
  announcements,
  announcementsError,
  fileCount,
}) {
  return (
    <div>
      <section className="animate-rise relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-sky-50 via-white to-blue-100/70 px-5 py-7 shadow-[0_20px_50px_-30px_rgba(37,99,235,0.35)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-32 h-56 w-56 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">
              Student dashboard
            </p>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              {getGreeting()}, {getFirstName(profile.full_name)}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Here is your academic snapshot. Keep your details current and check back for new campus
              updates.
            </p>
          </div>
          <span className="flex w-fit shrink-0 items-center gap-2 rounded-full border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-sm">
            <Icon name="shield" className="h-4 w-4" />
            Verified student
          </span>
        </div>

        <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/dashboard/files"
            className={`${BTN_PRIMARY} ${BTN_MD}`}
          >
            <Icon name="folder" className="h-4 w-4" />
            Open my files
          </Link>
          <Link
            href="/dashboard/updates"
            className={`${BTN_OUTLINE} ${BTN_MD}`}
          >
            <Icon name="megaphone" className="h-4 w-4" />
            Read updates
          </Link>
        </div>
      </section>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon="book" label="Course" value={profile.course || "—"} detail="Your current program" />
        <StatCard
          icon="calendar"
          label="Year"
          value={profile.year || "—"}
          detail="Academic standing"
          tone="sky"
        />
        <StatCard
          icon="layers"
          label="Block"
          value={profile.block ? `Block ${profile.block}` : "—"}
          detail="Your study group"
          tone="violet"
        />
        <StatCard
          icon="folder"
          label="My files"
          value={fileCount === null ? "—" : String(fileCount)}
          detail={fileCount === null ? "Storage not set up yet" : "Documents you uploaded"}
          tone="amber"
          href="/dashboard/files"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <section className={`${PANEL_LG} p-4 sm:p-5 lg:p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={MICRO}>Your profile</p>
              <h2 className={`mt-1.5 ${TITLE_LG}`}>Account details</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Icon name="user" className="h-5 w-5" strokeWidth={1.9} />
            </span>
          </div>
          <div className="mt-6 grid gap-x-8 sm:grid-cols-2">
            <DetailRow icon="user" label="Full name" value={profile.full_name} />
            <DetailRow icon="mail" label="Email address" value={profile.email} />
            <DetailRow icon="book" label="Course" value={profile.course} />
            <DetailRow icon="calendar" label="Year" value={profile.year} />
            <DetailRow icon="layers" label="Block" value={profile.block ? `Block ${profile.block}` : ""} />
            <DetailRow icon="clock" label="Member since" value={formatDate(profile.created_at)} />
          </div>
        </section>

        <section className={`${PANEL_LG} p-4 sm:p-5 lg:p-6`}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Icon name="sparkles" className="h-4.5 w-4.5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className={MICRO}>Quick guide</p>
              <h2 className={`mt-1 ${TITLE_LG}`}>Get the most from NextGen</h2>
            </div>
          </div>
          <ol className="mt-5 space-y-2.5">
            {[
              ["Keep your profile ready", "Your course, year, and block are ready for your next academic step."],
              ["Check updates often", "Published announcements from your admin team appear here."],
              ["Use it anywhere", "The dashboard is designed to feel natural on your phone."],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3 rounded-xl bg-slate-50/70 px-3.5 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-5">
        <SectionCard
          eyebrow="Stay in the loop"
          icon="bell"
          title="Latest updates"
          badge={
            <Link
              href="/dashboard/updates"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
            >
              View all
              <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Link>
          }
        >
          {announcementsError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              Updates are temporarily unavailable. Please try refreshing the page.
            </div>
          ) : (
            <AnnouncementList announcements={announcements} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}