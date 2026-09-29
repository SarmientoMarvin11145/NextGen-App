import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { AttendanceReport } from "@/components/attendance/attendance-report";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Attendance | NextGen",
  description: "Review and export attendance records.",
};

export default async function AdminAttendancePage({ searchParams }) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : "";

  const [eventsResult, sessionsResult] = await Promise.all([
    supabase.from("events").select("id, name, event_date").order("event_date", { ascending: false }),
    supabase
      .from("attendance_sessions")
      .select("id, event_id, name, session_date")
      .order("starts_at", { ascending: false }),
  ]);

  const events = eventsResult.data || [];
  const initialEventId = events.some((event) => event.id === requestedEventId)
    ? requestedEventId
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Attendance report"
        description="Filter the records recorded for each session, check the distance that was verified, and export exactly what you see to a CSV file."
        icon="chart"
        tone="indigo"
      />

      <AttendanceReport
        events={events}
        sessions={sessionsResult.data || []}
        initialEventId={initialEventId}
      />
    </div>
  );
}
