import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

// Supabase sends people here from the confirmation email. Once the account is
// verified the session is cleared on purpose so the flow ends on the login
// screen, exactly as the product requires.
export async function GET(request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code") || url.searchParams.get("error");

  const invalidPath = "/verify-email?status=invalid";
  const expiredPath = "/verify-email?status=expired";

  if (errorCode) {
    return NextResponse.redirect(
      new URL(errorCode === "otp_expired" ? expiredPath : invalidPath, url.origin),
    );
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=unavailable", url.origin));
  }

  if (tokenHash && type) {
    if (!OTP_TYPES.has(type)) {
      return NextResponse.redirect(new URL(invalidPath, url.origin));
    }

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      return NextResponse.redirect(
        new URL(error.code === "otp_expired" ? expiredPath : invalidPath, url.origin),
      );
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL(invalidPath, url.origin));
    }
  } else {
    return NextResponse.redirect(new URL(invalidPath, url.origin));
  }

  // Verification finished: drop the temporary session and send people to login.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/login?verified=1", url.origin));
}
