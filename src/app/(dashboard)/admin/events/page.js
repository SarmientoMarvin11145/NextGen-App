import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminEventList } from "@/components/events/admin-event-list";
import { getAuthContext } from "@/lib/supabase/auth";
import { BTN_MD, BTN_PRIMARY } from "@/lib/ui";

export const metadata = {
  title: "Events | NextGen",
  description: "Create and manage events and their attendance sessions.",
};

// Counts rows per event_id so the table can show sessions and scanners without
// one query per event.
function tally(rows) {
  const map = {};
  for (const row of rows || []) {
    map[row.event_id] = (map[row.event_id] || 0) + 1;
  }
  return map;
}

export default async function AdminEventsPage() {
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

  const [eventsResult, sessionsResult, scannersResult] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { ascending: false }),
    supabase.from("attendance_sessions").select("event_id"),
    supabase.from("attendance_scanners").select("event_id"),
  ]);

  const events = eventsResult.data || [];
  const ids = events.map((item) => item.id);

  let registrations = {};
  if (ids.length > 0) {
    const { data: countRows } = await supabase.rpc("event_registration_counts", {
      p_event_ids: ids,
    });
    registrations = Object.fromEntries(
      (countRows || []).map((row) => [row.event_id, Number(row.registration_count) || 0]),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Event management"
        description="Create events, schedule the attendance windows students can check in to, and assign the accounts allowed to scan their QR codes."
        icon="calendar"
        tone="indigo"
        actions={
          <Link href="/admin/events/create" className={`${BTN_PRIMARY} ${BTN_MD}`}>
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
            New event
          </Link>
        }
      />

      <AdminEventList
        events={events}
        registrations={registrations}
        sessions={tally(sessionsResult.data)}
        scanners={tally(scannersResult.data)}
      />
    </div>
  );
}
