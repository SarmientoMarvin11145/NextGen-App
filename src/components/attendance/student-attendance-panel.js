"use client";

// The student's "current attendance" surface (spec sections 12, 23, 24).
//
// It decides what to show from the database clock, mints a token for the
// active session, keeps the device location fresh, and renders the QR only
// once the backend has everything it needs to verify the scan.

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { LoadingPanel } from "@/components/ui/loading-spinner";
import { AttendanceStatus } from "./attendance-status";
import { AttendanceTimeline } from "./attendance-timeline";
import { QRCodeDisplay } from "./qr-code-display";
import { useAttendance } from "@/hooks/use-attendance";
import { formatClockTime, formatCountdown } from "@/lib/events";
import { MICRO, TITLE_LG } from "@/lib/ui";

export function StudentAttendancePanel({ event, studentId, focusSessionId = null }) {
  const state = useAttendance(event.id, studentId);

  const {
    loading,
    error,
    serverNowMs,
    sessions,
    activeSession,
    nextSession,
    isRegistered,
    attended,
    attendedSessionIds,
    registration,
    token,
    minting,
    mintError,
    retryMint,
    tokenReady,
    locationReady,
    locationError,
    reporting,
    syncLocation,
    geolocation,
    retry,
  } = state;

  const focusedSession = focusSessionId
    ? sessions.find((session) => session.id === focusSessionId) ?? null
    : null;

  // The database clock drives every countdown (spec section 12). The device
  // clock only stands in until the first response arrives, so it is captured
  // once: calling Date.now() during render would make this component impure.
  const [deviceNowMs] = useState(() => Date.now());
  const serverNow = serverNowMs ?? deviceNowMs;
  const toActiveEnd = activeSession
    ? Math.max(0, Date.parse(activeSession.ends_at) - serverNow)
    : 0;
  const toNextStart = nextSession
    ? Math.max(0, Date.parse(nextSession.starts_at) - serverNow)
    : 0;

  return (
    <div className="space-y-6">
      {focusedSession && focusedSession.id !== activeSession?.id ? (
        <FocusedSessionNotice session={focusedSession} />
      ) : null}

      <section
        aria-labelledby="current-attendance-title"
        className={`relative overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-7 ${
          activeSession && !attended ? "border-blue-200" : "border-slate-200/70"
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 ${
            activeSession && !attended ? "bg-blue-600" : "bg-slate-200"
          }`}
        />

        <div className="text-center">
          <p className={MICRO}>Current attendance</p>
          <h2 id="current-attendance-title" className={`mt-2 ${TITLE_LG}`}>
            {event.name}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {formatClockTime(event.start_time)} – {formatClockTime(event.end_time)} ·{" "}
            {event.location_name}
          </p>
        </div>

        <div className="mt-5">
          <AttendanceBody
            loading={loading}
            error={error}
            retry={retry}
            isRegistered={isRegistered}
            registration={registration}
            activeSession={activeSession}
            nextSession={nextSession}
            attended={attended}
            attendance={state.attendance}
            token={token}
            minting={minting}
            mintError={mintError}
            retryMint={retryMint}
            tokenReady={tokenReady}
            locationReady={locationReady}
            locationError={locationError}
            reporting={reporting}
            syncLocation={syncLocation}
            geolocation={geolocation}
            toActiveEnd={toActiveEnd}
            toNextStart={toNextStart}
            eventId={event.id}
          />
        </div>
      </section>

      <section aria-labelledby="attendance-timeline-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="attendance-timeline-title" className={TITLE_LG}>
            Attendance sessions
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {attendedSessionIds.length} of {sessions.length} attended
          </span>
        </div>
        <AttendanceTimeline
          sessions={sessions}
          attendedSessionIds={attendedSessionIds}
          attendance={state.attendance}
          focusSessionId={focusSessionId}
          emptyMessage={
            loading ? "Loading sessions…" : "No attendance sessions have been scheduled yet."
          }
        />
      </section>
    </div>
  );
}

function FocusedSessionNotice({ session }) {
  const copy = session.state === "closed" ? "Expired" : session.state;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon name="info" className="h-4.5 w-4.5 shrink-0 text-slate-400" />
        <p className="min-w-0 text-[13px] text-slate-600">
          Viewing <span className="font-semibold text-slate-800">{session.name}</span> ·{" "}
          {formatClockTime(session.start_time)} – {formatClockTime(session.end_time)}
        </p>
      </div>
      <AttendanceStatus state={copy} size="sm" />
    </div>
  );
}

// Decides which of the panel's mutually exclusive states to render.
function AttendanceBody({
  loading,
  error,
  retry,
  isRegistered,
  activeSession,
  nextSession,
  attended,
  attendance,
  token,
  minting,
  mintError,
  retryMint,
  locationReady,
  locationError,
  reporting,
  syncLocation,
  geolocation,
  toActiveEnd,
  toNextStart,
  eventId,
}) {
  if (error && !activeSession) {
    return (
      <NoticePanel tone="rose" icon="info" title="Could not load attendance">
        <p>{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Try again
        </button>
      </NoticePanel>
    );
  }

  if (loading && !activeSession && !error) {
    return <LoadingPanel label="Checking the current session…" />;
  }

  if (!isRegistered) {
    return (
      <NoticePanel tone="slate" icon="user" title="You are not registered yet">
        <p>Register for this event to receive a QR code for each attendance session.</p>
        <Link
          href={`/events/${eventId}#register`}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Go to registration
        </Link>
      </NoticePanel>
    );
  }

  if (!activeSession) {
    return nextSession ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-6 text-center">
        <p className={MICRO}>Next attendance</p>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-900">
          {nextSession.name}
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {formatClockTime(nextSession.start_time)} – {formatClockTime(nextSession.end_time)}
        </p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
          Starts in
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {formatCountdown(toNextStart)}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-[13px] leading-5 text-slate-600">
          Your QR code appears automatically when the session opens.
        </p>
      </div>
    ) : (
      <NoticePanel tone="slate" icon="clock" title="No attendance sessions yet">
        <p>Sessions for this event have not been scheduled. Check back soon.</p>
      </NoticePanel>
    );
  }

  if (attended) {
    const record = attendance.find((row) => row.attendance_session_id === activeSession.id);
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white shadow-sm">
          <Icon name="check" className="h-6 w-6" strokeWidth={2.6} />
        </span>
        <p className="mt-3.5 text-sm font-bold uppercase tracking-[0.14em] text-emerald-800">
          Attendance recorded
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">{activeSession.name}</p>
        {record ? (
          <p className="mt-1 text-sm text-slate-600">
            {new Date(record.recorded_at).toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {Number(record.distance_meters)} m from the venue
          </p>
        ) : null}
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-5 text-slate-600">
          You can close this page. Your attendance is stored and the next session will issue a new
          QR code.
        </p>
      </div>
    );
  }

  if (mintError) {
    return (
      <NoticePanel tone="rose" icon="info" title="Could not create your QR code">
        <p>{mintError}</p>
        <button
          type="button"
          onClick={retryMint}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Try again
        </button>
      </NoticePanel>
    );
  }

  if (!token) {
    return <LoadingPanel label={minting ? "Creating your QR code…" : "Preparing your QR code…"} />;
  }

  if (!locationReady) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-amber-600 shadow-sm">
          <Icon name="mapPin" className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="mt-3.5 text-sm font-semibold text-slate-900">
          Location required before your QR code is shown
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-slate-600">
          {locationError ||
            "Attendance is verified against your device's position. Without it the scan would be rejected."}
        </p>
        <button
          type="button"
          onClick={() => syncLocation()}
          disabled={geolocation.isLocating || reporting}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {geolocation.isLocating || reporting ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          ) : null}
          {geolocation.isLocating || reporting ? "Finding your location…" : "Enable location"}
        </button>
        <p className="mt-3 text-[11px] leading-4 text-slate-500">
          Your position refreshes automatically while the QR code is on screen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className={MICRO}>{activeSession.name}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-700">
        {formatClockTime(activeSession.start_time)} – {formatClockTime(activeSession.end_time)}
      </p>

      <div className="mt-4">
        <QRCodeDisplay value={token} />
      </div>

      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">
        Not yet attended
      </p>

      <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
        <Icon name="mapPin" className="h-4 w-4" strokeWidth={2.2} />
        Location shared · verified when scanned
      </p>

      <p className="mt-1 text-[13px] text-slate-500">
        Closes in{" "}
        <span className="font-mono font-semibold tabular-nums text-slate-700">
          {formatCountdown(toActiveEnd)}
        </span>
      </p>

      <p className="mt-4 max-w-sm text-[12px] leading-5 text-slate-400">
        A screenshot from an earlier session will not work: this code expires when the session ends.
      </p>
    </div>
  );
}

function NoticePanel({ tone, icon, title, children }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border px-5 py-6 text-center ${tones[tone] || tones.slate}`}>
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
        <Icon name={icon} className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-slate-900">{title}</p>
      <div className="mx-auto mt-1.5 max-w-md text-[13px] leading-5">{children}</div>
    </div>
  );
}


