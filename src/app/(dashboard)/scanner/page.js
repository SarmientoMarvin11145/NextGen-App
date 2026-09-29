import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScannerWorkspace } from "@/components/scanner/scanner-workspace";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Scanner | NextGen",
  description: "Verify student QR codes and record attendance.",
};

// Scanner access is derived from public.attendance_scanners, not from
// profiles.role, so any account an administrator assigned can open this page.
// Everything the scanner does is finalised by the verify-attendance Edge
// Function; this page only selects the event and shows results.
export default async function ScannerPage({ searchParams }) {
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile || !supabase) {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedEventId =
    typeof resolvedSearchParams.event === "string" ? resolvedSearchParams.event : null;

  const { data: assignments } = await supabase
    .from("attendance_scanners")
    .select("event_id")
    .eq("user_id", user.id);

  const eventIds = [...new Set((assignments || []).map((row) => row.event_id))];

  let events = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("events")
      .select("id, name")
      .in("id", eventIds)
      .order("event_date", { ascending: false });
    events = data || [];
  }

  const initialEventId = events.some((event) => event.id === requestedEventId)
    ? requestedEventId
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scanner"
        title="Attendance scanner"
        description="Pick the event you are working, start the camera, and let students show their QR code. Every scan is verified on the server against the session window, the registration, and the student's location."
        icon="scan"
        tone="indigo"
      />

      <ScannerWorkspace events={events} initialEventId={initialEventId} />
    </div>
  );
}
