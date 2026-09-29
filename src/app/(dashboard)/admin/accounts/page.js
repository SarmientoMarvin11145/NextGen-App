import { redirect } from "next/navigation";
import AccountDirectory from "@/components/dashboard/account-directory";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAuthContext } from "@/lib/supabase/auth";

export const metadata = {
  title: "Accounts | NextGen",
  description: "Search and review every registered NextGen account.",
};

export default async function AdminAccountsPage() {
  const { user, profile, supabase } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  if (!profile || !supabase) {
    return null;
  }

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: accounts, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, course, year, block, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        icon="users"
        tone="indigo"
        title="Accounts"
        description="Every registered student and administrator, filtered by role and block."
      />
      <AccountDirectory accounts={accounts || []} error={Boolean(error)} />
    </div>
  );
}
