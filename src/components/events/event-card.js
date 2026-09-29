import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AttendanceStatus } from "@/components/attendance/attendance-status";
import {
  eventStatusLabel,
  eventStatusTone,
  formatClockTime,
  formatEventDate,
  getRegistrationBlockReason,
  getSlotsLabel,
} from "@/lib/events";
import { META, MICRO, TITLE_LG, tone as toneOf } from "@/lib/ui";

// One published event as a browseable card (spec section 5). Rendered by a
// server component, so it stays interactive through links and a small client
// action passed in as `action`.
export function EventCard({
  event,
  registeredCount = 0,
  isRegistered = false,
  action = null,
}) {
  const accent = toneOf(eventStatusTone(event.status));
  const blockReason = getRegistrationBlockReason(event, registeredCount);
  const deadlineLabel = event.registration_deadline
    ? new Date(event.registration_deadline).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-200/80 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_34px_-20px_rgba(15,23,42,0.38)]">
      <div className="relative h-36 shrink-0 overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied banner URLs; a plain img avoids proxying them.
          <img
            src={event.image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/80">
            <Icon name="calendar" className="h-10 w-10" strokeWidth={1.4} />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/40 ${accent.soft}`}
          >
            {eventStatusLabel(event.status)}
          </span>
        </div>

        {isRegistered ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
            <Icon name="check" className="h-3 w-3" strokeWidth={3} />
            Registered
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className={`${TITLE_LG} line-clamp-2`}>{event.name}</h3>
        {event.description ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-slate-500">
            {event.description}
          </p>
        ) : null}

        <dl className="mt-3.5 space-y-1.5">
          <MetaRow icon="calendar" label={formatEventDate(event.event_date)} />
          <MetaRow
            icon="clock"
            label={`${formatClockTime(event.start_time)} – ${formatClockTime(event.end_time)}`}
          />
          <MetaRow icon="mapPin" label={event.location_name} />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3">
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${
            event.max_participants && registeredCount >= event.max_participants
              ? "text-rose-600"
              : "text-slate-600"
          }`}>
            <Icon name="users" className="h-3.5 w-3.5" strokeWidth={2} />
            {getSlotsLabel(event, registeredCount)}
          </span>
          {deadlineLabel ? <span className={META}>Closes {deadlineLabel}</span> : null}
        </div>

        <div className="mt-4 flex items-center gap-2" id="register">
          {action || (
            <Link
              href={`/events/${event.id}`}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800"
            >
              View event
              <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          )}
        </div>

        {blockReason && !isRegistered ? (
          <p className="mt-2 text-[11.5px] font-medium text-slate-400">{blockReason}</p>
        ) : null}
      </div>
    </article>
  );
}

function MetaRow({ icon, label }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="shrink-0 pt-0.5 text-slate-400">
        <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
      </dt>
      <dd className="min-w-0 text-[13px] font-medium leading-5 text-slate-600">{label}</dd>
    </div>
  );
}
