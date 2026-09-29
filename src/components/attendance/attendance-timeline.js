import { Icon } from "@/components/ui/icon";
import { AttendanceStatus } from "./attendance-status";
import { formatClockTime, formatEventDate, groupSessionsByDate } from "@/lib/events";
import { META, MICRO, TITLE } from "@/lib/ui";

// The attendance timeline from spec section 23: every session of the event
// grouped by day, each showing whether it is upcoming, open, attended, or
// closed, plus the exact time attendance was recorded.
//
// Purely presentational, so it works in a server component or inside the
// client QR panel.
export function AttendanceTimeline({
  sessions = [],
  attendedSessionIds = [],
  attendance = [],
  focusSessionId = null,
  emptyMessage = "No attendance sessions have been scheduled yet.",
}) {
  const groups = groupSessionsByDate(sessions);
  const attendanceBySession = new Map(
    attendance.map((row) => [row.attendance_session_id, row]),
  );

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
          <Icon name="calendar" className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <p className="mt-3.5 text-sm font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-slate-500">
          Sessions define the time, place, and radius for each attendance window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date || "day"} aria-label={formatEventDate(group.date)}>
          <div className="flex items-center gap-3">
            <p className={MICRO}>{formatEventDate(group.date)}</p>
            <span className="h-px flex-1 bg-slate-200/70" aria-hidden="true" />
          </div>
          <ol className="mt-3 space-y-3">
            {group.sessions.map((session) => {
              const attended = attendedSessionIds.includes(session.id);
              const record = attendanceBySession.get(session.id);
              const focused = focusSessionId === session.id;

              return (
                <TimelineRow
                  key={session.id}
                  session={session}
                  attended={attended}
                  record={record}
                  focused={focused}
                />
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineRow({ session, attended, record, focused }) {
  return (
    <li
      className={`relative flex gap-3.5 rounded-2xl border p-3.5 transition sm:gap-4 ${
        focused
          ? "border-blue-300 bg-blue-50/40 ring-2 ring-blue-100"
          : attended
            ? "border-emerald-200/70 bg-emerald-50/30"
            : session.state === "active"
              ? "border-blue-200 bg-blue-50/40"
              : "border-slate-200/70 bg-white"
      }`}
    >
      {/* Rail marker: filled when attended, ringed while the window is open. */}
      <div className="flex flex-col items-center pt-1" aria-hidden="true">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full ring-2 ${
            attended
              ? "bg-emerald-500 text-white ring-emerald-100"
              : session.state === "active"
                ? "bg-blue-600 text-white ring-blue-100"
                : session.state === "cancelled"
                  ? "bg-rose-100 text-rose-600 ring-rose-50"
                  : "bg-white text-slate-400 ring-slate-200"
          }`}
        >
          <Icon
            name={attended ? "check" : session.state === "active" ? "qr" : "clock"}
            className="h-3.5 w-3.5"
            strokeWidth={2.6}
          />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <h3 className={TITLE}>{session.name}</h3>
            <p className="mt-0.5 text-[13px] font-medium text-slate-500">
              {formatClockTime(session.start_time)} – {formatClockTime(session.end_time)}
            </p>
          </div>
          <AttendanceStatus state={session.state} attended={attended} size="sm" />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className={`inline-flex items-center gap-1.5 ${META}`}>
            <Icon name="mapPin" className="h-3.5 w-3.5" strokeWidth={2} />
            {session.allowed_radius} m radius
          </p>
          {attended && record ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
              Recorded{" "}
              {new Date(record.recorded_at).toLocaleTimeString("en-PH", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : (
            <p className={META}>
              {session.state === "upcoming"
                ? "Not yet available"
                : session.state === "active"
                  ? "Show your QR code"
                  : session.state === "closed"
                    ? "Session ended"
                    : "Cancelled"}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
