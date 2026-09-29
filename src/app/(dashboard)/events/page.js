import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { EventList } from "@/components/events/event-list";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Events | NextGen",
  description: "Browse events and register for attendance.",
};

export default async function EventsPage() {
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile || !supabase) {
    return null;
  }

  // Administrators manage events from the admin workspace; scanners work from
  // the scanner workspace.
  if (profile.role === "admin") {
    redirect("/admin/events");
  }

  const { data: eventRows } = await supabase
    .from("events")
    .select("*")
    .neq("status", "draft")
    .order("event_date", { ascending: true });

  const events = eventRows || [];
  const ids = events.map((item) => item.id);

  let counts = {};
  if (ids.length > 0) {
    const { data: countRows } = await supabase.rpc("event_registration_counts", {
      p_event_ids: ids,
    });
    counts = Object.fromEntries(
      (countRows || []).map((row) => [row.event_id, Number(row.registration_count) || 0]),
    );
  }

  const { data: registrationRows } = await supabase
    .from("event_registrations")
    .select("event_id, status")
    .eq("student_id", user.id);

  const registrations = Object.fromEntries(
    (registrationRows || []).map((row) => [row.event_id, row.status]),
  );

  const registeredCount = Object.values(registrations).filter(
    (status) => status === "registered",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Events and attendance"
        description={
          registeredCount > 0
            ? `You are registered for ${registeredCount} event${registeredCount === 1 ? "" : "s"}. Open an event to see its attendance QR code while a session is open.`
            : "Browse events, register for the ones you are attending, and present your QR code at the venue."
        }
        icon="calendar"
      />

      <EventList events={events} counts={counts} registrations={registrations} />
    </div>
  );
}
