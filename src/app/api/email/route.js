// POST /api/email — sends one email through Resend.
//
// The API key stays on this side of the wire: the browser posts here instead of
// importing the Resend SDK, so RESEND_API_KEY can never reach the client bundle.
//
// Body, every field optional:
//   to       recipient; defaults to the signed-in account's own address
//   subject  defaults to "Hello World"
//   html     defaults to the quick-start snippet's markup
//   text     optional plain-text alternative
//
// Only a signed-in account may send, and only an administrator may send to an
// address other than its own, so this endpoint can never be used as an open
// relay. Failures answer with the same { code, message } shape the Edge
// Functions use (see src/lib/supabase/edge.js), so callers can show the message
// verbatim and branch on the code.
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth";
import {
  EmailError,
  HELLO_WORLD_HTML,
  HELLO_WORLD_SUBJECT,
  isResendConfigured,
  isValidEmail,
  sendEmail,
} from "@/lib/resend";

function failure(code, message, status) {
  return NextResponse.json({ code, message }, { status });
}

// Returns the trimmed string, or "" when the field is absent or not a string.
function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  if (!isResendConfigured()) {
    return failure(
      "not_configured",
      "Resend is not configured. Replace re_xxxxxxxxx with your real API key in RESEND_API_KEY inside .env.local.",
      503,
    );
  }

  const { user, profile } = await getAuthContext();

  if (!user) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== "object") {
    payload = {};
  }

  const ownEmail = String(user.email || "").toLowerCase();
  const isAdmin = profile?.role === "admin";
  const to = readText(payload.to) || user.email;

  if (!isValidEmail(to)) {
    return failure("invalid_recipient", "Enter a valid email address.", 400);
  }

  // Anyone signed in may email themselves; an administrator may email anyone.
  // A mismatch is refused rather than silently redirected to the caller.
  if (to.toLowerCase() !== ownEmail && !isAdmin) {
    return failure(
      "forbidden",
      "Only an administrator can send to another address.",
      403,
    );
  }

  const subject = readText(payload.subject) || HELLO_WORLD_SUBJECT;
  const html = readText(payload.html) || HELLO_WORLD_HTML;
  const text = readText(payload.text) || null;

  try {
    const { id } = await sendEmail({ to, subject, html, text });

    return NextResponse.json({ ok: true, id, to, subject });
  } catch (error) {
    if (error instanceof EmailError) {
      return failure(error.code, error.message, error.code === "not_configured" ? 503 : 502);
    }

    return failure("unknown", "The email could not be sent.", 502);
  }
}
