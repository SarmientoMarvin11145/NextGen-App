"use client";

// Admin: browse and export attendance records (spec sections 42, 43).
//
// Only reads public.attendance, which RLS already restricts to administrators.
// Names are resolved with a second query against public.profiles because
// student_id and scanner_id point at auth.users, so PostgREST cannot embed the
// profile row directly. The CSV is built in the browser by attendance-export.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LoadingPanel } from "@/components/ui/loading-spinner";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { buildAttendanceCsv, downloadCsv } from "@/lib/attendance-export";
import { formatEventDate } from "@/lib/events";
import { BTN_MD, BTN_OUTLINE, BTN_PRIMARY, FIELD, META, MICRO, PANEL, tone as toneOf } from "@/lib/ui";

const ROW_LIMIT = 500;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "—";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function humanise(message) {
  const text = String(message || "");
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (text.includes("row-level security")) return "Only administrators can read the attendance report.";
  if (text.length > 160) return "The report could not be loaded. Please try again.";
  return text || "The report could not be loaded. Please try again.";
}

export function AttendanceReport({ events = [], sessions = [], initialEventId = null }) {
  const [eventId, setEventId] = useState(initialEventId || "");
  const [sessionId, setSessionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const eventMap = useMemo(() => new Map(events.map((item) => [item.id, item])), [events]);
  const sessionMap = useMemo(() => new Map(sessions.map((item) => [item.id, item])), [sessions]);
  const sessionOptions = useMemo(
    () => (eventId ? sessions.filter((session) => session.event_id === eventId) : sessions),
    [sessions, eventId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();

      let request = supabase
        .from("attendance")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(ROW_LIMIT);

      if (eventId) request = request.eq("event_id", eventId);
      if (sessionId) request = request.eq("attendance_session_id", sessionId);
      if (from) request = request.gte("recorded_at", new Date(`${from}T00:00:00`).toISOString());
      if (to) request = request.lte("recorded_at", new Date(`${to}T23:59:59.999`).toISOString());

      const { data, error: readError } = await request;
      if (readError) throw readError;

      const ids = [
        ...new Set((data || []).flatMap((row) => [row.student_id, row.scanner_id]).filter(Boolean)),
      ];

      let profiles = [];
      if (ids.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        if (profileError) throw profileError;
        profiles = profileRows || [];
      }
      const byId = new Map(profiles.map((profile) => [profile.id, profile]));

      setRows(
        (data || []).map((row) => {
          const student = byId.get(row.student_id) || null;
          const scanner = row.scanner_id ? byId.get(row.scanner_id) || null : null;
          const event = eventMap.get(row.event_id) || null;
          const session = sessionMap.get(row.attendance_session_id) || null;
          const rejected = row.status === "rejected";

          return {
            id: row.id,
            studentName: student?.full_name || student?.email?.split("@")[0] || "Unknown student",
            studentEmail: student?.email || "",
            eventName: event?.name || "Event",
            sessionName: session?.name || "Session",
            scannerName: scanner?.full_name || scanner?.email?.split("@")[0] || "System",
            recordedAt: row.recorded_at,
            recordedAtLabel: formatDateTime(row.recorded_at),
            locationLabel: formatCoordinates(row.student_latitude, row.student_longitude),
            distanceMeters: Number(row.distance_meters),
            locationVerified: Boolean(row.location_verified),
            status: rejected ? "rejected" : "present",
            statusLabel: rejected ? "Rejected" : "Present",
          };
        }),
      );
      setError(null);
    } catch (loadError) {
      setRows([]);
      setError(humanise(loadError?.message));
    } finally {
      setLoading(false);
    }
  }, [eventId, sessionId, from, to, eventMap, sessionMap]);

  useEffect(() => {
    // The first read happens after mount: Postgres is the external system this
    // effect synchronises into local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flips its own loading flag
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.studentName} ${row.studentEmail} ${row.sessionName}`.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const presentCount = visible.filter((row) => row.status === "present").length;

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = eventMap.get(eventId)?.name || "all-events";
    const slug = scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadCsv(`attendance-${slug || "report"}-${stamp}.csv`, buildAttendanceCsv(visible));
  };

  const capped = rows.length >= ROW_LIMIT;

  return (
    <div className="space-y-5">
      <form
        className={`${PANEL} p-4 sm:p-5`}
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          load();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="report-event" className={MICRO}>
              Event
            </label>
            <select
              id="report-event"
              value={eventId}
              onChange={(changeEvent) => {
                setEventId(changeEvent.target.value);
                setSessionId("");
              }}
              className={`${FIELD} mt-2`}
            >
              <option value="">All events</option>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-session" className={MICRO}>
              Session
            </label>
            <select
              id="report-session"
              value={sessionId}
              onChange={(changeEvent) => setSessionId(changeEvent.target.value)}
              className={`${FIELD} mt-2`}
            >
              <option value="">All sessions</option>
              {sessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.session_date ? ` · ${formatEventDate(session.session_date)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-from" className={MICRO}>
              From
            </label>
            <input
              id="report-from"
              type="date"
              value={from}
              onChange={(changeEvent) => setFrom(changeEvent.target.value)}
              className={`${FIELD} mt-2`}
            />
          </div>

          <div>
            <label htmlFor="report-to" className={MICRO}>
              To
            </label>
            <input
              id="report-to"
              type="date"
              value={to}
              onChange={(changeEvent) => setTo(changeEvent.target.value)}
              className={`${FIELD} mt-2`}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              strokeWidth={2}
            />
            <input
              type="search"
              value={search}
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              placeholder="Filter by student or session"
              aria-label="Filter records"
              className={`${FIELD} pl-11`}
            />
          </div>
          <button type="submit" disabled={loading} className={`${BTN_OUTLINE} ${BTN_MD}`}>
            <Icon
              name="refresh"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || visible.length === 0}
            className={`${BTN_PRIMARY} ${BTN_MD}`}
          >
            <Icon name="download" className="h-4 w-4" strokeWidth={2} />
            Export CSV
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <ReportStat label="Records" value={visible.length} tone="blue" />
        <ReportStat label="Present" value={presentCount} tone="blue" />
        <ReportStat
          label="Rejected"
          value={visible.length - presentCount}
          tone={visible.length - presentCount > 0 ? "rose" : "slate"}
        />
      </div>

      {capped ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-800">
          Showing the most recent {ROW_LIMIT} records. Narrow the filters to see an older slice.
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

      {loading ? (
        <LoadingPanel label="Loading attendance records" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="chart"
          title="No attendance yet"
          description="Records appear here as soon as a scanner verifies a student's QR code."
        />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th>Student</Th>
                  <Th>Session</Th>
                  <Th>Recorded</Th>
                  <Th>Distance</Th>
                  <Th>Scanner</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block text-[13.5px] font-semibold text-slate-900">
                        {row.studentName}
                      </span>
                      {row.studentEmail ? (
                        <span className="mt-0.5 block text-[11.5px] font-medium text-slate-500">
                          {row.studentEmail}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-[13px] font-medium text-slate-700">
                        {row.sessionName}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-medium text-slate-500">
                        {row.eventName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-slate-600">
                      {row.recordedAtLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-[13px] font-medium tabular-nums text-slate-700">
                        {Number.isFinite(row.distanceMeters)
                          ? `${row.distanceMeters.toFixed(1)} m`
                          : "—"}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-medium text-slate-500">
                        {row.locationVerified ? "Location verified" : "Not verified"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-600">
                      {row.scannerName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                          row.status === "present"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`${META} border-t border-slate-100 px-4 py-3`}>
            {visible.length} record{visible.length === 1 ? "" : "s"} · exported file contains exactly
            these rows.
          </p>
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500"
    >
      {children}
    </th>
  );
}

function ReportStat({ label, value, tone = "blue" }) {
  const accent = toneOf(tone);

  return (
    <div className={`${PANEL} px-4 py-3.5`}>
      <p className={MICRO}>{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${accent.text}`}>{value}</p>
    </div>
  );
}

