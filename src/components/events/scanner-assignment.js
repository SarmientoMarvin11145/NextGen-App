"use client";

// Admin: choose which accounts may scan QR codes for one event (spec section 17).
//
// public.attendance_scanners is the only source of truth for scanner
// permission, so this component just inserts and deletes rows there and then
// re-reads the table, which keeps the list correct even if a second
// administrator changes assignments at the same time.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getInitials } from "@/lib/format";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { BTN_MD, BTN_OUTLINE, FIELD, META, MICRO, PANEL } from "@/lib/ui";

function displayName(profile) {
  return profile?.full_name || profile?.email?.split("@")[0] || "Unnamed account";
}

function humanise(message) {
  const text = String(message || "");
  if (text.includes("duplicate key")) return "That account is already assigned to this event.";
  if (text.includes("row-level security")) return "Only administrators can change scanner assignments.";
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (text.length > 160) return "The assignment could not be saved. Please try again.";
  return text || "The assignment could not be saved. Please try again.";
}

export function ScannerAssignment({
  event,
  assignments = [],
  candidates = [],
  currentUserId = null,
}) {
  const router = useRouter();
  const [rows, setRows] = useState(assignments);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const assignedIds = useMemo(() => new Set(rows.map((row) => row.user_id)), [rows]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return candidates
      .filter((profile) => !assignedIds.has(profile.id))
      .filter((profile) => {
        if (!needle) return true;
        return `${displayName(profile)} ${profile.email || ""}`.toLowerCase().includes(needle);
      })
      .slice(0, 8);
  }, [candidates, assignedIds, query]);

  const reload = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: readError } = await supabase
      .from("attendance_scanners")
      .select("id, user_id, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    if (readError) throw readError;

    const ids = (data || []).map((row) => row.user_id);
    let profiles = [];
    if (ids.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (profileError) throw profileError;
      profiles = profileRows || [];
    }

    setRows(
      (data || []).map((row) => ({
        ...row,
        profile: profiles.find((profile) => profile.id === row.user_id) || null,
      })),
    );
  };

  const assign = async (profile) => {
    setBusyId(profile.id);
    setError(null);
    setNotice(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();
      const { error: insertError } = await supabase.from("attendance_scanners").insert({
        event_id: event.id,
        user_id: profile.id,
        assigned_by: currentUserId,
      });
      if (insertError) throw insertError;

      await reload();
      setQuery("");
      setNotice(`${displayName(profile)} can now scan for this event.`);
      router.refresh();
    } catch (assignError) {
      setError(humanise(assignError?.message));
    } finally {
      setBusyId(null);
    }
  };

  const unassign = async (row) => {
    setBusyId(row.user_id);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from("attendance_scanners")
        .delete()
        .eq("id", row.id);
      if (deleteError) throw deleteError;

      await reload();
      setNotice(`${displayName(row.profile)} can no longer scan for this event.`);
      router.refresh();
    } catch (unassignError) {
      setError(humanise(unassignError?.message));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <div>
        <p className={MICRO}>Assigned scanners</p>
        <p className="mt-1 text-[13px] text-slate-500">
          {rows.length === 0
            ? "No one can scan attendance for this event yet."
            : `${rows.length} account${rows.length === 1 ? "" : "s"} may scan attendance.`}
        </p>

        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon="scan"
              tone="indigo"
              title="No scanners assigned"
              description="Assign at least one account so someone can verify student QR codes at the venue."
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`${PANEL} flex flex-wrap items-center justify-between gap-3 p-3.5`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                    {getInitials(row.profile?.full_name, row.profile?.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                      {displayName(row.profile)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] font-medium text-slate-500">
                      {row.profile?.email || row.user_id}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => unassign(row)}
                  disabled={busyId === row.user_id}
                  className={`${BTN_OUTLINE} ${BTN_MD} text-[13px] text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700`}
                >
                  {busyId === row.user_id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label htmlFor="scanner-search" className={MICRO}>
          Add a scanner
        </label>
        <div className="relative mt-2">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
          />
          <input
            id="scanner-search"
            type="text"
            value={query}
            onChange={(searchEvent) => setQuery(searchEvent.target.value)}
            placeholder="Search by name or email"
            className={`${FIELD} pl-11`}
            autoComplete="off"
          />
        </div>

        {results.length === 0 ? (
          <p className={`${META} mt-3`}>
            {candidates.length === 0
              ? "No accounts are available to assign."
              : query
                ? "No account matches that search."
                : "Every available account is already assigned to this event."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {results.map((profile) => (
              <li
                key={profile.id}
                className={`${PANEL} flex flex-wrap items-center justify-between gap-3 p-3.5`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-slate-900">
                    {displayName(profile)}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] font-medium text-slate-500">
                    {profile.email}
                    {profile.role === "admin" ? " · Administrator" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => assign(profile)}
                  disabled={busyId === profile.id}
                  className={`${BTN_OUTLINE} ${BTN_MD} text-[13px]`}
                >
                  <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
                  {busyId === profile.id ? "Assigning…" : "Assign"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

