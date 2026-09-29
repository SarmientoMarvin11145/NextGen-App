import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/auth";
import { getPostAuthPathForUser } from "@/lib/supabase/navigation";

export default async function Home() {
  const { user, profile } = await getAuthContext();

  redirect(getPostAuthPathForUser(user, profile));
}