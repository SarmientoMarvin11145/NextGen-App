import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { EventForm } from "@/components/events/event-form";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "New event | NextGen",
  description: "Publish a new event with its venue and attendance radius.",
};

export default async function CreateEventPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="New event"
        description="Students only see an event once its status is Published or Ongoing. Attendance sessions can be added right after the event is saved."
        icon="plus"
        tone="indigo"
      />

      <EventForm />
    </div>
  );
}
