import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StudentAttendancePanel } from "@/components/attendance/student-attendance-panel";
import { RegistrationPanel } from "@/components/events/registration-panel";
import { getAuthContext } from "@/lib/supabase/auth";
import {
  eventStatusLabel,
  eventStatusTone,
  formatClockTime,
  formatEventDate,
  getSlotsLabel,
} from "@/lib/events";
import { BTN_MD, BTN_OUTLINE, BTN_PRIMARY, META, MICRO, PANEL, tone as toneOf } from "@/lib/ui";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { supabase } = await getAuthContext();

  if (!supabase) {
    return { title: "Event | NextGen" };
  }

  const { data: event } = await supabase.from("events").select("name").eq("id", id).maybeSingle();

  return {
    title: event?.name ? `${event.name} | NextGen` : "Event | NextGen",
    description: "Event details, registration, and your attendance QR code.",
  };
}

export default async function EventDetailPage({ params }) {
  const { id } = await params;
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile || !supabase) {
    return null;
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();

  if (!event) {
    notFound();
  }

  const [countsResult, registrationResult] = await Promise.all([
    supabase.rpc("event_registration_counts", { p_event_ids: [event.id] }),
    supabase
      .from("event_registrations")
      .select("id, status, registered_at")
      .eq("event_id", event.id)
      .eq("student_id", user.id)
      .maybeSingle(),
  ]);

  const registeredCount = Number(countsResult.data?.[0]?.registration_count ?? 0);
  const registration = registrationResult.data || null;
  const isRegistered = registration?.status === "registered";
  const isAdmin = profile.role === "admin";
  const accent = toneOf(eventStatusTone(event.status));

  const deadlineLabel = event.registration_deadline
    ? new Date(event.registration_deadline).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <Link
        href={isAdmin ? "/admin/events" : "/events"}
        className={`${MICRO} inline-flex items-center gap-1.5 hover:text-slate-700`}
      >
        <Icon name="arrowLeft" className="h-3.5 w-3.5" strokeWidth={2.4} />
        {isAdmin ? "Back to event management" : "Back to events"}
      </Link>

      <div className={`${PANEL} overflow-hidden`}>
        <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 sm:h-52">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-supplied banner URLs; a plain img avoids proxying them.
            <img src={event.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/80">
              <Icon name="calendar" className="h-12 w-12" strokeWidth={1.3} />
            </div>
          )}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/40 ${accent.soft}`}
            >
              {eventStatusLabel(event.status)}
            </span>
            {isRegistered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                Registered
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <PageHeader
            eyebrow={formatEventDate(event.event_date)}
            title={event.name}
            icon="calendar"
            actions={
              isAdmin ? (
                <Link href={`/admin/events/${event.id}`} className={`${BTN_OUTLINE} ${BTN_MD}`}>
                  <Icon name="edit" className="h-4 w-4" strokeWidth={2} />
                  Manage event
                </Link>
              ) : null
            }
          />

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow
              icon="clock"
              label="Time"
              value={`${formatClockTime(event.start_time)} – ${formatClockTime(event.end_time)}`}
            />
            <InfoRow icon="mapPin" label="Venue" value={event.location_name} />
            <InfoRow icon="layers" label="Allowed radius" value={`${Number(event.allowed_radius)} m`} />
            <InfoRow
              icon="users"
              label="Participants"
              value={getSlotsLabel(event, registeredCount)}
            />
          </dl>

          {deadlineLabel ? <p className={`${META} mt-4`}>Registration closes {deadlineLabel}</p> : null}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isAdmin ? (
            <SectionCard
              eyebrow="Administration"
              title="Attendance is managed from the admin workspace"
              icon="shield"
              tone="indigo"
              description="Sessions, scanner assignment, and the attendance report for this event live on the admin side."
            >
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/events/${event.id}`} className={`${BTN_PRIMARY} ${BTN_MD}`}>
                  <Icon name="edit" className="h-4 w-4" strokeWidth={2} />
                  Manage sessions
                </Link>
                <Link
                  href={`/admin/events/${event.id}#scanners`}
                  className={`${BTN_OUTLINE} ${BTN_MD}`}
                >
                  <Icon name="scan" className="h-4 w-4" strokeWidth={2} />
                  Scanner assignment
                </Link>
                <Link
                  href={`/admin/attendance?event=${event.id}`}
                  className={`${BTN_OUTLINE} ${BTN_MD}`}
                >
                  <Icon name="chart" className="h-4 w-4" strokeWidth={2} />
                  Attendance report
                </Link>
              </div>
            </SectionCard>
          ) : (
            <StudentAttendancePanel event={event} studentId={user.id} />
          )}
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="About" title="Event details" icon="info">
            {event.description ? (
              <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                {event.description}
              </p>
            ) : (
              <p className={META}>No description was provided for this event.</p>
            )}

            <dl className="mt-4 space-y-3">
              <InfoRow icon="calendar" label="Date" value={formatEventDate(event.event_date)} />
              <InfoRow
                icon="clock"
                label="Time"
                value={`${formatClockTime(event.start_time)} – ${formatClockTime(event.end_time)}`}
              />
              <InfoRow icon="mapPin" label="Venue" value={event.location_name} />
              <InfoRow
                icon="layers"
                label="Attendance radius"
                value={`${Number(event.allowed_radius)} m from the venue`}
              />
              <InfoRow
                icon="users"
                label="Participants"
                value={getSlotsLabel(event, registeredCount)}
              />
            </dl>
          </SectionCard>

          {isAdmin ? null : (
            <SectionCard
              id="register"
              eyebrow="Registration"
              title={isRegistered ? "Your registration" : "Reserve a slot"}
              icon="userCheck"
              className="scroll-mt-24"
            >
              <RegistrationPanel
                event={event}
                registration={registration}
                registeredCount={registeredCount}
              />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400">
        <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className={`block ${MICRO}`}>{label}</span>
        <span className="mt-1 block text-[13.5px] font-medium leading-5 text-slate-700">
          {value}
        </span>
      </span>
    </div>
  );
}

