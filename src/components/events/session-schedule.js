"use client";

// Admin: the attendance schedule for one event (spec section 41).
//
// Sessions are plain table writes guarded by RLS (only admins may insert,
// update, or delete), so this component re-reads the schedule after every
// change instead of trusting its own optimistic state. `starts_at`/`ends_at`
// are built by SessionForm; nothing here recomputes the window.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SessionForm } from "./session-form";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  formatEventDate,
  formatSessionWindow,
  groupSessionsByDate,
  sessionStateLabel,
  sessionStateTone,
} from "@/lib/events";
import { BTN_MD, BTN_OUTLINE, BTN_PRIMARY, META, MICRO, PANEL, TITLE, tone as toneOf } from "@/lib/ui";

// Postgres messages reach the admin verbatim otherwise; keep them short.
function humanise(message) {
  const text = String(message || "");
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (text.includes("window_check")) return "The session must end after it starts.";
  if (text.includes("allowed_radius")) return "Allowed radius must be between 1 and 10000 metres.";
  if (text.includes("char_length")) return "The session name must be between 2 and 120 characters.";
  if (text.includes("row-level security")) return "Only administrators can change the schedule.";
  if (text.length > 160) return "The session could not be saved. Please try again.";
  return text || "The session could not be saved. Please try again.";
}

export function SessionSchedule({ event, sessions = [], serverNowMs = null }) {
  const router = useRouter();
  const [items, setItems] = useState(sessions);
  const [editor, setEditor] = useState(null); // { session } | null
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [listError, setListError] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setListError("Supabase is not configured. Check your environment variables.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("event_id", event.id)
      .order("starts_at", { ascending: true });

    if (error) {
      setListError(humanise(error.message));
      return;
    }
    setItems(data || []);
    setListError(null);
  }, [event.id]);

  const save = async (payload, { isEditing, id }) => {
    setSaving(true);
    setFormError(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();
      const { error } = isEditing
        ? await supabase.from("attendance_sessions").update(payload).eq("id", id)
        : await supabase.from("attendance_sessions").insert(payload);

      if (error) throw error;

      await load();
      setEditor(null);
      setNotice(isEditing ? "Session updated." : "Session added.");
      router.refresh();
    } catch (saveError) {
      setFormError(humanise(saveError?.message));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (session, status) => {
    setBusyId(session.id);
    setListError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ status })
        .eq("id", session.id);
      if (error) throw error;
      await load();
      setNotice(status === "cancelled" ? "Session cancelled." : "Session reopened.");
      router.refresh();
    } catch (statusError) {
      setListError(humanise(statusError?.message));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (session) => {
    setBusyId(session.id);
    setConfirmId(null);
    setListError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("attendance_sessions").delete().eq("id", session.id);
      if (error) throw error;
      await load();
      setNotice("Session deleted.");
      router.refresh();
    } catch (removeError) {
      setListError(humanise(removeError?.message));
    } finally {
      setBusyId(null);
    }
  };

  const groups = groupSessionsByDate(items);

  // Session badges are derived from the database clock the admin page resolved
  // (spec section 41). The device clock is a fallback captured once, so the
  // render stays pure and can never disagree with itself mid-render.
  const [deviceNowMs] = useState(() => Date.now());
  const nowMs = serverNowMs ?? deviceNowMs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={MICRO}>Attendance schedule</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {items.length === 0
              ? "No sessions yet. Students can only mark attendance while a session is open."
              : `${items.length} session${items.length === 1 ? "" : "s"} on this event.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setEditor({ session: null });
          }}
          className={`${BTN_PRIMARY} ${BTN_MD}`}
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
          Add session
        </button>
      </div>

      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700">
          {notice}
        </p>
      ) : null}

      {listError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700"
        >
          {listError}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon="calendar"
          tone="amber"
          title="No attendance sessions"
          description="Add at least one session so students have a window in which their QR code can be scanned."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date || "undated"}>
              <p className={MICRO}>{group.date ? formatEventDate(group.date) : "Date not set"}</p>
              <ul className="mt-2 space-y-2">
                {group.sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    state={deriveSessionState(session, nowMs)}
                    busy={busyId === session.id}
                    confirming={confirmId === session.id}
                    onEdit={() => {
                      setFormError(null);
                      setEditor({ session });
                    }}
                    onToggleStatus={() =>
                      setStatus(
                        session,
                        session.status === "cancelled" ? "scheduled" : "cancelled",
                      )
                    }
                    onAskDelete={() => setConfirmId(session.id)}
                    onCancelDelete={() => setConfirmId(null)}
                    onDelete={() => remove(session)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editor)}
        onClose={() => {
          if (!saving) {
            setEditor(null);
            setFormError(null);
          }
        }}
        title={editor?.session ? "Edit attendance session" : "New attendance session"}
        description="Students can only present a QR code while the session window is open."
        busy={saving}
      >
        {editor ? (
          <SessionForm
            key={editor.session?.id || "new-session"}
            event={event}
            session={editor.session}
            submitting={saving}
            error={formError}
            onCancel={() => setEditor(null)}
            onSaved={save}
          />
        ) : null}
      </Modal>
    </div>
  );
}

// Mirrors public.attendance_session_state() against the server clock the page
// passed in, so this badge can never disagree with what the scanner sees.
function deriveSessionState(session, nowMs) {
  if (!session) return "closed";
  if (session.status === "cancelled") return "cancelled";
  const startsAt = Date.parse(session.starts_at);
  const endsAt = Date.parse(session.ends_at);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return "closed";
  if (nowMs < startsAt) return "upcoming";
  if (nowMs >= endsAt) return "closed";
  return "active";
}

function SessionRow({
  session,
  state,
  busy,
  confirming,
  onEdit,
  onToggleStatus,
  onAskDelete,
  onCancelDelete,
  onDelete,
}) {
  const accent = toneOf(sessionStateTone(state));

  return (
    <li className={`${PANEL} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={TITLE}>{session.name}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${accent.soft}`}
            >
              {sessionStateLabel(state)}
            </span>
          </div>
          <p className={`${META} mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1`}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" className="h-3.5 w-3.5" strokeWidth={2} />
              {formatSessionWindow(session)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="mapPin" className="h-3.5 w-3.5" strokeWidth={2} />
              {Number(session.latitude).toFixed(5)}, {Number(session.longitude).toFixed(5)}
            </span>
            <span>{Number(session.allowed_radius)} m radius</span>
          </p>
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <span className="text-xs font-semibold text-rose-700">Delete this session?</span>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="h-9 rounded-lg bg-rose-600 px-3 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="h-9 rounded-lg px-2.5 text-[13px] font-semibold text-rose-700 transition hover:bg-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className={`${BTN_OUTLINE} ${BTN_MD} text-[13px]`}
            >
              <Icon name="edit" className="h-4 w-4" strokeWidth={2} />
              Edit
            </button>
            <button
              type="button"
              onClick={onToggleStatus}
              disabled={busy}
              className={`${BTN_OUTLINE} ${BTN_MD} text-[13px]`}
            >
              {session.status === "cancelled" ? "Reopen" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label={`Delete ${session.name}`}
              className={`${BTN_OUTLINE} ${BTN_MD} text-[13px] text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700`}
            >
              <Icon name="trash" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}


