// Invokes a Supabase Edge Function from the browser with the caller's own JWT.
//
// The publishable (anon) key is sent as `apikey` so Supabase routes the request
// to the Functions gateway, while `Authorization` carries the *user's* access
// token. The functions themselves call `requireUser()` to resolve who is
// calling, and the service-role key never leaves Supabase (spec section 30).

function getFunctionsBaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local.");
  }
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

// Turns an Edge Function HTTP failure into an Error that keeps the machine
// readable `code` (e.g. "not_registered") so callers can pick a friendly
// message instead of echoing internals at the user.
function toHttpError(status, payload, name) {
  const code = payload?.code || payload?.error || null;
  const message =
    payload?.message ||
    (typeof code === "string" ? code : null) ||
    `The ${name} request failed (${status}).`;
  const error = new Error(message);
  error.status = status;
  error.code = typeof code === "string" ? code : null;
  return error;
}

export async function invokeEdgeFunction(name, body = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    );
  }

  // Imported lazily so this module can also be referenced from server code
  // paths that never actually call it.
  const { getSupabaseBrowserClient } = await import("./client");
  const supabase = getSupabaseBrowserClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    const unauthorized = new Error("Your session has expired. Please sign in again.");
    unauthorized.code = "unauthorized";
    unauthorized.status = 401;
    throw unauthorized;
  }

  let response;
  try {
    response = await fetch(`${getFunctionsBaseUrl()}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    const offline = new Error("Could not reach the server. Check your connection and try again.");
    offline.code = "network";
    throw offline;
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw toHttpError(response.status, payload, name);
  }

  return payload;
}
