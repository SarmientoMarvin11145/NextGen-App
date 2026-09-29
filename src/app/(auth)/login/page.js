import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/auth-form";
import { getAuthContext } from "@/lib/supabase/auth";
import { getPostAuthPathForUser } from "@/lib/supabase/navigation";

export const metadata = {
  title: "Sign in | NextGen",
  description: "Sign in to your NextGen student dashboard.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const verified = params?.verified === "1";
  const { user, profile } = await getAuthContext();

  // `verified=1` arrives from /auth/confirm, so the sign-in form must render
  // even though confirming the email created a short lived session.

  if (user && !verified) {
    redirect(getPostAuthPathForUser(user, profile));
  }

  return <AuthForm mode="login" verified={verified} />;
}
