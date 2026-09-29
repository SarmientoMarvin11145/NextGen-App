"use client";

// Scanner workspace (spec sections 14, 15, 21, 22).
//
// The scanner only ever sends the raw QR payload plus the event id to the
// verify-attendance Edge Function. It never checks the token, the session, or
// the distance itself: every decision comes back from the backend.

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { LoadingPanel } from "@/components/ui/loading-spinner";
import { QRScanner } from "./qr-scanner";
import { fetchAttendanceContext, verifyAttendance } from "@/lib/attendance";
import { getAttendanceFailureMessage, formatClockTime } from "@/lib/events";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { MICRO, PANEL, TITLE_LG } from "@/lib/ui";

const POLL_MS = 30000;

export function ScannerWorkspace({ events = [], initialEventId = null }) {
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);

  const busyRef = useRef(false);

  const event = events.find((item) => item.id === eventId) || events[0] || null;
  const activeSession = context?.activeSessionId
    ? context.sessions.find((session) => session.id === context.activeSessionId) ?? null
    : null;

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!eventId) return;
      if (!silent) setLoading(true);
      try {
        const next = await fetchAttendanceContext(eventId);
        setContext(next);
        setError(null);
      } catch (loadError) {
        setError(loadError?.message || "Could not load this event's attendance session.");
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    // Switching event must never show the previous event's session: the slate
    // is cleared before the new read starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on event change
    setContext(null);
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId) return undefined;
    const timer = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [eventId, load]);

  // Live feed of newly recorded attendance for this event.
  useEffect(() => {
    if (!eventId || !isSupabaseConfigured()) return undefined;

    let supabase;
    let channel;
    try {
      supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel(`scanner-feed-${eventId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "attendance",
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => setLog((current) => prepend(current, payload.new)),
        )
        .subscribe();
    } catch {
      return undefined;
    }

    return () => {
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [eventId]);

  const handleScan = async (rawValue) => {
    if (busyRef.current || !eventId) return;
    busyRef.current = true;
    setVerifying(true);
    setResult(null);

    try {
      const outcome = await verifyAttendance(String(rawValue).trim(), eventId);
      setResult(outcome);
      setLog((current) =>
        prepend(current, {
          id: `scan-${Date.now()}`,
          student_name: outcome.ok ? outcome.studentName : "Rejected",
          session_name: outcome.ok ? outcome.sessionName : "—",
          recorded_at: outcome.ok ? outcome.recordedAt : new Date().toISOString(),
          distance_meters: outcome.distanceMeters,
          ok: outcome.ok,
        }),
      );
      if (outcome.ok) load({ silent: true });
    } catch (scanError) {
      setResult({
        ok: false,
        code: scanError?.code || "network",
        message: scanError?.message || getAttendanceFailureMessage(scanError?.code),
      });
    } finally {
      setVerifying(false);
      busyRef.current = false;
    }
  };

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
          <Icon name="scan" className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <p className="mt-4 text-sm font-semibold text-slate-800">No events assigned to you</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-slate-500">
          An administrator must assign your account as a scanner before you can record attendance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {events.length > 1 ? (
        <div className={`${PANEL} p-4`}>
          <label htmlFor="scanner-event" className={MICRO}>
            Event
          </label>
          <select
            id="scanner-event"
            value={eventId}
            onChange={(event_) => setEventId(event_.target.value)}
            className="mt-2 h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
          >
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <section className={`${PANEL} p-4 sm:p-5`} aria-labelledby="scanner-session-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={MICRO}>Event</p>
            <h2 id="scanner-session-title" className={`mt-1.5 ${TITLE_LG}`}>
              {event?.name}
            </h2>

            {loading && !context ? (
              <p className="mt-3 text-sm text-slate-500">Loading current session…</p>
            ) : error ? (
              <p className="mt-3 text-sm text-rose-600">{error}</p>
            ) : activeSession ? (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">
                  Current session
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">{activeSession.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {formatClockTime(activeSession.start_time)} –{" "}
                  {formatClockTime(activeSession.end_time)} · {activeSession.allowed_radius} m radius
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700">No active attendance session</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  The scanner opens when a session window begins.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScanning((value) => !value)}
            disabled={!activeSession || verifying}
            className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              scanning
                ? "bg-slate-800 text-white hover:bg-slate-700"
                : "bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] hover:bg-blue-700"
            }`}
          >
            <Icon name={scanning ? "x" : "scan"} className="h-4.5 w-4.5" strokeWidth={2.2} />
            {scanning ? "Stop scanner" : "Start scanner"}
          </button>
        </div>
      </section>

      <QRScanner active={scanning} onScan={handleScan} />

      {verifying ? (
        <LoadingPanel label="Verifying attendance…" icon="shield" />
      ) : result ? (
        <ScanResult result={result} />
      ) : null}

      <section aria-labelledby="scanner-log-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="scanner-log-title" className={TITLE_LG}>
            Recent scans
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {log.length} shown
          </span>
        </div>

        {log.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No scans yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-slate-500">
              Results appear here as you scan, alongside anything other scanners record for this
              event.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {log.map((item) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  item.ok === false
                    ? "border-rose-200 bg-rose-50/60"
                    : "border-slate-200/70 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">
                    {item.student_name || "Student"}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {item.session_name || "—"}
                    {item.distance_meters !== null && item.distance_meters !== undefined
                      ? ` · ${Number(item.distance_meters)} m`
                      : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                    item.ok === false ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <Icon
                    name={item.ok === false ? "x" : "check"}
                    className="h-3 w-3"
                    strokeWidth={3}
                  />
                  {item.ok === false ? "Rejected" : "Recorded"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScanResult({ result }) {
  const success = Boolean(result.ok);

  return (
    <div
      role="status"
      className={`animate-rise rounded-2xl border p-5 text-center ${
        success ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
      }`}
    >
      <span
        className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-white ${
          success ? "bg-emerald-600" : "bg-rose-600"
        }`}
      >
        <Icon name={success ? "check" : "x"} className="h-6 w-6" strokeWidth={2.8} />
      </span>

      <p
        className={`mt-3.5 text-sm font-bold uppercase tracking-[0.14em] ${
          success ? "text-emerald-800" : "text-rose-800"
        }`}
      >
        {success ? "Attendance recorded" : "Attendance rejected"}
      </p>

      {success ? (
        <dl className="mx-auto mt-3 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-left">
          <ResultRow label="Student" value={result.studentName} />
          <ResultRow label="Session" value={result.sessionName} />
          <ResultRow
            label="Time"
            value={
              result.recordedAt
                ? new Date(result.recordedAt).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
          <ResultRow label="Location" value={result.locationVerified ? "Verified" : "—"} />
          <ResultRow label="Distance" value={`${Number(result.distanceMeters)} m`} />
          <ResultRow label="Allowed" value={`${Number(result.allowedRadius)} m`} />
        </dl>
      ) : (
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-6 text-rose-800">
          {result.message || getAttendanceFailureMessage(result.code)}
        </p>
      )}
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <>
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="truncate text-[13.5px] font-semibold text-slate-800">{value}</dd>
    </>
  );
}

function prepend(current, row) {
  if (!row) return current;
  return [row, ...current.filter((item) => item.id !== row.id)].slice(0, 8);
}


