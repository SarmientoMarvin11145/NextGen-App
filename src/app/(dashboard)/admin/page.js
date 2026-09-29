import { redirect } from "next/navigation";
import AdminDashboardView from "@/components/dashboard/admin-dashboard-view";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Overview | NextGen",
  description: "Administrator overview for the NextGen portal.",
};

export default async function AdminPage() {
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

  const [accountsResult, announcementsResult, filesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, course, year, block, role, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("announcements")
      .select("id, title, body, created_at, published")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("files").select("id, folder", { count: "exact" }),
  ]);

  return (
    <AdminDashboardView
      profile={profile}
      accounts={accountsResult.data || []}
      announcements={announcementsResult.data || []}
      accountsError={Boolean(accountsResult.error)}
      announcementsError={Boolean(announcementsResult.error)}
      fileCount={filesResult.error ? null : filesResult.count ?? 0}
    />
  );
}
