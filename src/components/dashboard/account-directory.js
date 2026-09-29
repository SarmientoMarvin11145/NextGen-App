"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Icon } from "@/components/ui/icon";
import { BLOCKS } from "@/lib/constants";
import { formatDate, getInitials } from "@/lib/format";
import { FIELD_ICON, MICRO, PANEL_INTERACTIVE, PANEL_LG, SCROLL_ROW } from "@/lib/ui";

const ROLE_FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "user", label: "Students" },
  { value: "admin", label: "Admins" },
];

export default function AccountDirectory({ accounts = [], error = false }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [block, setBlock] = useState("all");

  const counts = useMemo(
    () => ({
      all: accounts.length,
      user: accounts.filter((account) => account.role !== "admin").length,
      admin: accounts.filter((account) => account.role === "admin").length,
    }),
    [accounts],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return accounts.filter((account) => {
      if (role !== "all" && (account.role === "admin" ? "admin" : "user") !== role) return false;
      if (block !== "all" && account.block !== block) return false;
      if (!term) return true;

      return [account.full_name, account.email, account.course, account.year].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      );
    });
  }, [accounts, query, role, block]);

  const isFiltered = Boolean(query.trim()) || role !== "all" || block !== "all";

  function resetFilters() {
    setQuery("");
    setRole("all");
    setBlock("all");
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          Account data is temporarily unavailable. Refresh the page to try again.
        </div>
      ) : null}

      <div className={`${PANEL_LG} p-4 sm:p-5 lg:p-6`}>
        <div className="flex items-start gap-2.5">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search accounts</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
              strokeWidth={1.9}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, or course"
              className={`${FIELD_ICON}`}
            />
          </label>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-3 text-xs font-semibold tabular-nums text-slate-600 sm:inline-flex">
            <Icon name="users" className="h-4 w-4" />
            {filtered.length}
            <span className="font-medium text-slate-500">of {accounts.length}</span>
          </span>
        </div>

        <div className="mt-3 flex gap-1 rounded-xl bg-slate-100/80 p-1">
          {ROLE_FILTERS.map((filter) => {
            const active = role === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRole(filter.value)}
                aria-pressed={active}
                className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="truncate">{filter.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    active ? "bg-blue-50 text-blue-700" : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={MICRO}>Block</p>
          {isFiltered ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 transition hover:text-blue-700"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className={`mt-2 ${SCROLL_ROW}`}>
          {[
            { value: "all", label: "All blocks" },
            ...BLOCKS.map((value) => ({ value, label: `Block ${value}` })),
          ].map((option) => {
            const active = block === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBlock(option.value)}
                aria-pressed={active}
                className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)]"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {filtered.length ? (
            <ul className="space-y-2.5">
              {filtered.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={isFiltered ? "search" : "users"}
              title={isFiltered ? "No accounts match these filters" : "No accounts yet"}
              description={
                isFiltered
                  ? "Try clearing the search field or choosing a different block."
                  : "Registered students appear here as soon as they sign up."
              }
              action={
                isFiltered ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-[12px] font-semibold tabular-nums text-slate-700">
        {value || "—"}
      </dd>
    </div>
  );
}

// Hoisted helper so the directory above stays short and readable.
function AccountCard({ account }) {
  const isAdmin = account.role === "admin";

  return (
    <li className={`${PANEL_INTERACTIVE} p-3.5 sm:p-4`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            isAdmin ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"
          }`}
        >
          {getInitials(account.full_name, account.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {account.full_name || "Unnamed student"}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{account.email}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                isAdmin ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {isAdmin ? "Admin" : "Student"}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Detail label="Course" value={account.course} />
            <Detail label="Year" value={account.year} />
            <Detail label="Block" value={account.block ? `Block ${account.block}` : ""} />
            <Detail label="Joined" value={formatDate(account.created_at)} />
          </dl>
        </div>
      </div>
    </li>
  );
}

