import { redirect } from "next/navigation";
import AnnouncementComposer from "@/components/dashboard/announcement-composer";
import AnnouncementList from "@/components/dashboard/announcement-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge, SectionCard } from "@/components/dashboard/section-card";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Updates | NextGen",
  description: "Publish and review campus announcements.",
};

export default async function AdminUpdatesPage() {
  const { user, profile, supabase } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!profile || !supabase) {
    return null;
  }

  if (profile.role !== "admin") {
    redirect("/dashboard/updates");
  }

  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, published")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Broadcast"
        icon="megaphone"
        tone="indigo"
        title="Updates"
        description="Write an announcement once and every verified student sees it instantly."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <SectionCard eyebrow="Compose" icon="plus" title="Share an update">
          <AnnouncementComposer />
        </SectionCard>

        <SectionCard
          eyebrow="Published content"
          icon="bell"
          title="Latest updates"
          badge={<Badge tone="blue">Visible to students</Badge>}
        >
          {error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Updates are temporarily unavailable. Please try refreshing the page.
            </div>
          ) : (
            <AnnouncementList
              announcements={announcements || []}
              emptyMessage="Publish your first update for the student community."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
