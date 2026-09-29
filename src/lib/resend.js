// Resend (outbound email) helper.
//
// Server only. RESEND_API_KEY is a secret, so this module is imported by route
// handlers and server code and never by a "use client" file: the browser posts
// to POST /api/email instead of talking to Resend itself.
//
//   RESEND_API_KEY=re_...                          # https://resend.com/api-keys
//   RESEND_FROM_EMAIL=onboarding@resend.dev
//
// The key is read at call time rather than at import time, and the value shipped
// in .env.example is treated as "not configured" so a forgotten placeholder
// produces one clear sentence instead of a 401 from Resend.
import { Resend } from "resend";

// The placeholder that ships in .env.example. It is not a key, so it is refused
// before any request is made.
export const RESEND_PLACEHOLDER_KEY = "re_xxxxxxxxx";

// Resend's shared test sender. It only delivers to the address that owns the
// Resend account, so set RESEND_FROM_EMAIL once a domain is verified.
export const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";

// The message from the Resend quick-start snippet, kept here so the API route,
// the terminal check, and any future caller all send the same thing.
export const HELLO_WORLD_SUBJECT = "Hello World";
export const HELLO_WORLD_HTML =
  "<p>Congrats on sending your <strong>first email</strong>!</p>";

// Deliberately loose. It rejects obvious typos such as a missing @ without
// pretending to decide what a real mailbox is; Resend does the real check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let client;

// A failure that carries a machine readable code plus a sentence that is safe to
// render verbatim, mirroring AttendanceError in src/lib/attendance.js.
export class EmailError extends Error {
  constructor(code, message, statusCode = null) {
    super(message || "The email could not be sent.");
    this.name = "EmailError";
    this.code = code || "unknown";
    this.statusCode = statusCode;
  }
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

// Returns the configured key, or null while it is still the placeholder.
export function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === RESEND_PLACEHOLDER_KEY) return null;
  return apiKey;
}

export function isResendConfigured() {
  return Boolean(getResendApiKey());
}

export function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
}

export function getResendClient() {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new EmailError(
      "not_configured",
      `Resend is not configured. Replace ${RESEND_PLACEHOLDER_KEY} with your real API key in RESEND_API_KEY inside .env.local.`,
    );
  }

  // One client per server process, exactly like getSupabaseBrowserClient().
  if (!client) {
    client = new Resend(apiKey);
  }

  return client;
}

/**
 * Sends one email through Resend and resolves with `{ id }`, the id Resend
 * assigns to the message.
 *
 * `from` falls back to RESEND_FROM_EMAIL, and at least one of `html` or `text`
 * is required because the Resend API rejects a message that carries neither.
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
} = {}) {
  if (!to) {
    throw new EmailError("missing_recipient", "An email needs at least one recipient.");
  }

  if (!subject) {
    throw new EmailError("missing_subject", "An email needs a subject.");
  }

  if (!html && !text) {
    throw new EmailError("missing_content", "An email needs html or text content.");
  }

  const resend = getResendClient();

  let response;
  try {
    response = await resend.emails.send({
      from: from || getFromAddress(),
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
    });
  } catch {
    // The SDK reports API refusals inside `error` instead of throwing, so
    // reaching this branch means the request never completed at all.
    throw new EmailError(
      "network",
      "Could not reach Resend. Check your connection and try again.",
    );
  }

  if (response.error || !response.data) {
    throw new EmailError(
      response.error?.name || "unknown",
      response.error?.message || "Resend rejected the message.",
      response.error?.statusCode ?? null,
    );
  }

  return { id: response.data.id, from: from || getFromAddress(), to, subject };
}

// The quick-start snippet as one call, used by POST /api/email and by
// `npm run email:test`.
export async function sendHelloWorldEmail(to) {
  return sendEmail({ to, subject: HELLO_WORLD_SUBJECT, html: HELLO_WORLD_HTML });
}
