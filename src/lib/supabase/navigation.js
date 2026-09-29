export function getVerifyEmailPath(email) {
  const value = typeof email === "string" ? email.trim() : "";
  return value ? `/verify-email?email=${encodeURIComponent(value)}` : "/verify-email";
}

// Single source of truth for "where does this account go next".
export function getPostAuthPathForUser(user, profile) {
  if (!user) {
    return "/login";
  }

  if (!user.email_confirmed_at) {
    return getVerifyEmailPath(user.email);
  }

  if (profile?.role === "admin") {
    return "/admin";
  }

  // A scanner account only has the assigned-scanning workflow to do, so it
  // lands straight on the scanner workspace.
  if (profile?.role === "scanner") {
    return "/scanner";
  }

  return "/dashboard";
}

export async function getPostAuthPath(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/login";
  }

  if (!user.email_confirmed_at) {
    return getVerifyEmailPath(user.email);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return getPostAuthPathForUser(user, profile);
}
