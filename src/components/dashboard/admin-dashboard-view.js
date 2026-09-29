import Link from "next/link";
import AnnouncementList from "./announcement-list";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge, SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Icon } from "@/components/ui/icon";
import { BTN, BTN_MD, BTN_OUTLINE, PANEL } from "@/lib/ui";
import { getFirstName, getInitials } from "@/lib/format";

function AccountRow({ account }) {
  const isAdmin = account.role === "admin";

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3.5 last:border-0">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          isAdmin ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"
        }`}
      >
        {getInitials(account.full_name, account.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">
          {account.full_name || "Unnamed student"}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{account.email}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold text-slate-600">{account.course || "—"}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">
          {account.year || "—"} · Block {account.block || "—"}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
          isAdmin ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {isAdmin ? "Admin" : "Student"}
      </span>
    </div>
  );
}

export default function AdminDashboardView({
  profile,
  accounts,
  announcements,
  accountsError,
  announcementsError,
  fileCount,
}) {
  const studentCount = accounts.filter((account) => account.role !== "admin").length;
  const adminCount = accounts.filter((account) => account.role === "admin").length;

  return (
    <div>
      <section className="animate-rise relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-100/60 px-5 py-7 shadow-[0_20px_50px_-30px_rgba(79,70,229,0.35)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-20 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700">Administration</p>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Good to see you, {getFirstName(profile.full_name)}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Monitor your community, keep account information organized, and share timely updates with
              every student.
            </p>
          </div>
          <span className="flex w-fit shrink-0 items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm">
            <Icon name="shield" className="h-4 w-4" />
            Admin access verified
          </span>
        </div>

        <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Link
            href="/admin/accounts"
            className={`${BTN} ${BTN_MD} bg-indigo-600 text-white shadow-[0_1px_2px_rgba(79,70,229,0.3)] hover:bg-indigo-700`}
          >
            <Icon name="users" className="h-4 w-4" />
            Review accounts
          </Link>
          <Link
            href="/admin/files"
            className={`${BTN} ${BTN_MD} border border-slate-300 bg-white/80 text-slate-700 hover:border-indigo-300 hover:bg-white hover:text-indigo-800`}
          >
            <Icon name="folder" className="h-4 w-4" />
            Manage files
          </Link>
          <Link
            href="/admin/updates"
            className={`${BTN} ${BTN_MD} border border-slate-300 bg-white/80 text-slate-700 hover:border-indigo-300 hover:bg-white hover:text-indigo-800`}
          >
            <Icon name="megaphone" className="h-4 w-4" />
            Publish update
          </Link>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          icon="users"
          label="Accounts"
          value={accounts.length}
          detail="Registered"
          href="/admin/accounts"
        />
        <StatCard
          icon="userCheck"
          label="Students"
          value={studentCount}
          detail="Standard access"
          tone="sky"
        />
        <StatCard
          icon="shield"
          label="Admins"
          value={adminCount}
          detail="Elevated access"
          tone="indigo"
        />
        <StatCard
          icon="folder"
          label="Files"
          value={fileCount === null ? "—" : fileCount}
          detail="Stored documents"
          tone="amber"
          href="/admin/files"
        />
        <StatCard
          icon="megaphone"
          label="Updates"
          value={announcements.length}
          detail="Published"
          href="/admin/updates"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <SectionCard
          id="accounts"
          eyebrow="People"
          icon="users"
          tone="indigo"
          title="Recent accounts"
          badge={
            <Link
              href="/admin/accounts"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
            >
              View all
              <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Link>
          }
        >
          {accountsError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              Account data is temporarily unavailable. Please refresh to try again.
            </div>
          ) : accounts.length ? (
            <div>
              {accounts.slice(0, 5).map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No accounts yet"
              description="Students appear here as soon as they register."
            />
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard eyebrow="File management" icon="folder" tone="indigo" title="Folder layout">
            <ul className="space-y-2.5">
              {[
                ["admin/", "Documents uploaded by administrators."],
                ["user/<student id>/", "Every student upload stays inside their own folder."],
              ].map(([label, description]) => (
                <li key={label} className={`flex items-start gap-3 ${PANEL} p-3.5`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon name="folder" className="h-4.5 w-4.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] font-semibold text-slate-800">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/admin/files"
              className={`${BTN} ${BTN_MD} mt-5 w-full bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              <Icon name="upload" className="h-4 w-4" />
              Open file management
            </Link>
          </SectionCard>

          <SectionCard eyebrow="Access control" icon="shield" tone="indigo" title="Admin roles are protected">
            <p className="text-xs leading-5 text-slate-500">
              Role changes are intentionally managed in Supabase SQL so students cannot promote
              themselves.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-50 px-3.5 py-2.5 font-mono text-[11px] leading-5 text-indigo-800">{`update public.profiles set role = 'admin' where email = 'you@example.com';`}</code>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5">
        <SectionCard
          eyebrow="Published content"
          icon="bell"
          title="Latest updates"
          badge={<Badge tone="blue">Visible to students</Badge>}
        >
          {announcementsError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              Updates are temporarily unavailable. Please refresh to try again.
            </div>
          ) : (
            <AnnouncementList
              announcements={announcements}
              emptyMessage="Publish your first update for the student community."
            />
          )}
          <Link
            href="/admin/updates"
            className={`${BTN_OUTLINE} ${BTN_MD} mt-5 w-full sm:w-auto`}
          >
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
            Write a new update
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}