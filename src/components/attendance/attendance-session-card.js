import { Icon } from "@/components/ui/icon";
import { AttendanceStatus } from "./attendance-status";
import { formatClockTime, formatEventDate, sessionStateLabel } from "@/lib/events";
import { MICRO, PANEL, TITLE, META, tone as toneOf } from "@/lib/ui";

// One attendance session as a card: name, window, location, radius, state.
// Reused by the student timeline preview, the scanner summary, and the admin
// schedule so all three describe a session identically.
export function AttendanceSessionCard({
  session,
  attended = false,
  recordedAt = null,
  focused = false,
  action = null,
  className = "",
}) {
  const accent = toneOf(attended ? "sky" : focused ? "blue" : "slate");

  return (
    <article
      className={`relative ${PANEL} p-4 transition ${
        focused ? "border-blue-300 ring-2 ring-blue-100" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent.soft}`}
            aria-hidden="true"
          >
            <Icon name={attended ? "check" : "clock"} className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className={MICRO}>{formatEventDate(session.session_date)}</p>
            <h3 className={`mt-1 ${TITLE}`}>{session.name}</h3>
            <p className="mt-1 text-[13px] font-semibold text-slate-600">
              {formatClockTime(session.start_time)} – {formatClockTime(session.end_time)}
            </p>
          </div>
        </div>
        <AttendanceStatus state={session.state} attended={attended} size="sm" />
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        <div>
          <dt className={META}>Radius</dt>
          <dd className="mt-0.5 text-[13px] font-semibold text-slate-700">
            {session.allowed_radius} m
          </dd>
        </div>
        <div>
          <dt className={META}>{attended ? "Recorded" : "Status"}</dt>
          <dd className="mt-0.5 text-[13px] font-semibold text-slate-700">
            {attended && recordedAt
              ? new Date(recordedAt).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : sessionStateLabel(session.state)}
          </dd>
        </div>
      </dl>

      {action ? <div className="mt-3.5">{action}</div> : null}
    </article>
  );
}
