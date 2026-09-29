import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import SetupNotice from "@/components/dashboard/setup-notice";
import { getAuthContext } from "@/lib/supabase/auth";
import { getVerifyEmailPath } from "@/lib/supabase/navigation";

export default async function DashboardLayout({ children }) {
  const { user, profile, supabase, error } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  // An account that has not confirmed its email never reaches the workspace.
  if (!user.email_confirmed_at) {
    redirect(getVerifyEmailPath(user.email));
  }

  if (error || !profile) {
    return <SetupNotice />;
  }

  // Scanner access is granted per event, so the workspace only offers the
  // scanner shortcut to accounts that actually hold an assignment.
  let canScan = false;
  if (supabase) {
    const { count } = await supabase
      .from("attendance_scanners")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    canScan = Boolean(count);
  }

  return (
    <DashboardShell profile={profile} user={user} canScan={canScan}>
      {children}
    </DashboardShell>
  );
}