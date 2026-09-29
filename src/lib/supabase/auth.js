import { cache } from "react";
import { getSupabaseServerClient } from "./server";

const PROFILE_COLUMNS =
  "id, email, full_name, course, year, block, role, terms_accepted_at, created_at, updated_at";

export const getCurrentUser = cache(async () => {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
});

export const getAuthContext = cache(async () => {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      profile: null,
      error: new Error("Supabase environment variables are not configured."),
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { supabase, user: null, profile: null, error: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, profile, error };
});