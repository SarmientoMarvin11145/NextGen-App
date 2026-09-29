// Turns Supabase auth errors into plain, friendly sentences. Shared by the
// login/register form and the email verification panel.
export function getAuthErrorMessage(error) {
  const message = error?.message?.toLowerCase() || "";
  const code = error?.code?.toLowerCase() || "";

  if (code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }
  if (message.includes("invalid login")) {
    return "The email or password you entered is incorrect.";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("email not confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (message.includes("password")) {
    return "Please choose a password with at least 8 characters.";
  }
  if (message.includes("email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("failed to fetch")) {
    return "We could not reach the authentication service. Check your connection and try again.";
  }

  return error?.message || "Something went wrong. Please try again.";
}
