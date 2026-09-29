import { redirect } from "next/navigation";
import AnnouncementList from "@/components/dashboard/announcement-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge, SectionCard } from "@/components/dashboard/section-card";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Campus updates | NextGen",
  description: "Read the latest announcements for your campus.",
};

export default async function DashboardUpdatesPage() {
  const { user, profile, supabase } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!profile || !supabase) {
    return null;
  }

  if (profile.role === "admin") {
    redirect("/admin/updates");
  }

  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stay in the loop"
        icon="megaphone"
        title="Campus updates"
        description="Everything your administration team has published for students."
      />
      <SectionCard
        eyebrow="Published content"
        icon="bell"
        title="Announcements"
        badge={<Badge tone="blue">{`${(announcements || []).length} total`}</Badge>}
      >
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Updates are temporarily unavailable. Please try refreshing the page.
          </div>
        ) : (
          <AnnouncementList announcements={announcements || []} />
        )}
      </SectionCard>
    </div>
  );
}
