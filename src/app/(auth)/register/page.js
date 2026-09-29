import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/auth-form";
import { getAuthContext } from "@/lib/supabase/auth";
import { getPostAuthPathForUser } from "@/lib/supabase/navigation";

export const metadata = {
  title: "Create account | NextGen",
  description: "Create your NextGen student account.",
};

export default async function RegisterPage() {
  const { user, profile } = await getAuthContext();

  // Unverified accounts are sent to /verify-email by getPostAuthPathForUser.
  if (user) {
    redirect(getPostAuthPathForUser(user, profile));
  }

  return <AuthForm mode="register" />;
}