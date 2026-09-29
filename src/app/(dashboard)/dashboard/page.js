import { redirect } from "next/navigation";
import UserDashboardView from "@/components/dashboard/user-dashboard-view";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Overview | NextGen",
  description: "Your NextGen student overview.",
};

export default async function UserDashboardPage() {
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (error || !profile || !supabase) {
    return null;
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  const [announcementsResult, filesResult] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
  ]);

  return (
    <UserDashboardView
      profile={profile}
      announcements={announcementsResult.data || []}
      announcementsError={Boolean(announcementsResult.error)}
      fileCount={filesResult.error ? null : filesResult.count ?? 0}
    />
  );
}
