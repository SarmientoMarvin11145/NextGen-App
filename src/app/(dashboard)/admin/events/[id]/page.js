import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { ScannerAssignment } from "@/components/events/scanner-assignment";
import { SessionSchedule } from "@/components/events/session-schedule";
import { getAuthContext } from "@/lib/supabase/auth";
import { formatEventDate, getSlotsLabel } from "@/lib/events";
import { BTN_MD, BTN_OUTLINE } from "@/lib/ui";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { supabase } = await getAuthContext();

  if (!supabase) {
    return { title: "Manage event | NextGen" };
  }

  const { data: event } = await supabase.from("events").select("name").eq("id", id).maybeSingle();

  return {
    title: event?.name ? `Manage ${event.name} | NextGen` : "Manage event | NextGen",
    description: "Edit the event, its attendance sessions, and its scanner assignments.",
  };
}

export default async function AdminEventDetailPage({ params }) {
  const { id } = await params;
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile || !supabase) {
    return null;
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();

  if (!event) {
    notFound();
  }

  const [sessionsResult, assignmentsResult, profilesResult, countsResult, nowResult] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select("*")
        .eq("event_id", event.id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("attendance_scanners")
        .select("id, user_id, created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name", { ascending: true }),
      supabase.rpc("event_registration_counts", { p_event_ids: [event.id] }),
      supabase.rpc("db_now"),
    ]);

  const profiles = profilesResult.data || [];
  const assignments = (assignmentsResult.data || []).map((row) => ({
    ...row,
    profile: profiles.find((item) => item.id === row.user_id) || null,
  }));

  const registeredCount = Number(countsResult.data?.[0]?.registration_count ?? 0);
  const serverNowMs = nowResult.data ? Date.parse(nowResult.data) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatEventDate(event.event_date)}
        title={event.name}
        description={`${event.location_name} · ${Number(event.allowed_radius)} m attendance radius · ${getSlotsLabel(event, registeredCount)}`}
        icon="settings"
        tone="indigo"
        actions={
          <>
            <Link href={`/events/${event.id}`} className={`${BTN_OUTLINE} ${BTN_MD}`}>
              <Icon name="eye" className="h-4 w-4" strokeWidth={2} />
              Student view
            </Link>
            <Link href="/admin/events" className={`${BTN_OUTLINE} ${BTN_MD}`}>
              <Icon name="arrowLeft" className="h-4 w-4" strokeWidth={2} />
              All events
            </Link>
          </>
        }
      />
      <SectionCard
        id="details"
        eyebrow="Event"
        title="Event details"
        description="Changes are visible to students immediately once the status is Published or Ongoing."
        icon="edit"
        tone="indigo"
        className="scroll-mt-24"
      >
        <EventForm event={event} />
      </SectionCard>

      <SectionCard
        id="sessions"
        eyebrow="Attendance"
        title="Attendance sessions"
        description="Each session opens a window in which students can present a fresh QR code."
        icon="clock"
        tone="indigo"
        className="scroll-mt-24"
      >
        <SessionSchedule event={event} sessions={sessionsResult.data || []} serverNowMs={serverNowMs} />
      </SectionCard>

      <SectionCard
        id="scanners"
        eyebrow="Attendance"
        title="Scanner assignments"
        description="Only the accounts listed here may verify student QR codes for this event."
        icon="scan"
        tone="indigo"
        className="scroll-mt-24"
      >
        <ScannerAssignment
          event={event}
          assignments={assignments}
          candidates={profiles}
          currentUserId={user.id}
        />
      </SectionCard>

      <SectionCard
        id="danger"
        eyebrow="Danger zone"
        title="Delete this event"
        description="Deleting removes the event together with its registrations, sessions, and attendance records. This cannot be undone."
        icon="trash"
        tone="rose"
        className="scroll-mt-24"
      >
        <DeleteEventButton event={event} />
      </SectionCard>
    </div>
  );
}

