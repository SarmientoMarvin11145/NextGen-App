// Supabase Edge Function shared helpers (spec sections 16 to 22, 30, 34).
//
// Everything security relevant lives here and runs on the server with the
// service-role key. The browser only ever posts the caller's own JWT plus a
// token string, an event id, or a pair of coordinates.
//
// Eight validation layers are enforced across the four functions:
//   1. the request carries a valid Supabase user JWT        requireUser()
//   2. the caller is an assigned scanner for the event      assertScanner()
//   3. the raw token maps to a stored digest                hashToken()
//   4. the token belongs to this event, is unused, and is   verify-attendance
//      still inside its window                              (ordered checks)
//   5. the session window is open on the clock              findOpenSession()
//   6. the event is accepting attendance                    isEventAcceptingAttendance()
//   7. the student is registered and not already present    loadRegistration(), hasAttended()
//   8. the student's reported position is fresh and inside  checkLocation()
//      the session radius
import { createClient } from "jsr:@supabase/supabase-js@2";
export const LOCATION_FRESHNESS_MS = 90_000;
export const MAX_TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// The same sentences the scanner shows for each machine readable code. Keeping
// them here means a scan result is readable even if a client maps nothing.
export const FAILURE_MESSAGES = {
    TOKEN_NOT_FOUND: "QR code is not valid or has already rotated.",
    TOKEN_EXPIRED: "QR code expired for this session.",
    TOKEN_USED: "QR code was already used.",
    SESSION_NOT_ACTIVE: "Attendance session is not active right now.",
    EVENT_MISMATCH: "QR code does not belong to this event.",
    EVENT_NOT_ACTIVE: "Event is not accepting attendance.",
    NOT_REGISTERED: "You are not registered for this event.",
    ALREADY_ATTENDED: "You have already attended this session.",
    SCANNER_NOT_AUTHORIZED: "This scanner is not authorized for this event.",
    LOCATION_MISSING: "Student location has not been reported yet.",
    LOCATION_STALE: "Student location is outdated, rescan shortly.",
    OUT_OF_RADIUS: "You are outside the allowed attendance area.",
    unauthorized: "Your session has expired. Please sign in again.",
    not_registered: "You are not registered for this event.",
    no_active_session: "There is no active attendance session right now.",
    already_attended: "You have already attended this session.",
    session_not_active: "This attendance session is not active right now.",
    token_used: "This QR code was already used.",
    token_not_found: "QR code is not valid or has already rotated.",
    forbidden: "You are not allowed to perform this action.",
    invalid_request: "The request was incomplete. Please try again.",
    network: "Could not reach the server. Check your connection and try again.",
    unexpected: "Attendance could not be recorded. Please try again.",
};
// An HTTP failure the browser can turn into a friendly sentence. `code` is
// machine readable and matches ATTENDANCE_FAILURE_MESSAGES in src/lib/events.js.
export class HttpError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message || FAILURE_MESSAGES[code] || FAILURE_MESSAGES.unexpected);
        this.name = "HttpError";
        this.code = code;
        this.status = status;
    }
}
export function corsPreflight() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}
// Business-rule refusals answer with HTTP 200 and { ok: false, code, message }
// so the scanner can show the reason instead of a transport error.
export function rejection(code, extra = {}) {
    return jsonResponse({
        ok: false,
        code,
        message: FAILURE_MESSAGES[code] || FAILURE_MESSAGES.unexpected,
        ...extra,
    });
}
export function handleError(error) {
    if (error instanceof HttpError) {
        return jsonResponse({ error: error.code, code: error.code, message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : String(error ?? "");
    // RLS and constraint failures are already user readable in this schema.
    const friendly = message && message.length <= 180 ? message : FAILURE_MESSAGES.unexpected;
    return jsonResponse({ error: "unexpected", code: "unexpected", message: friendly }, 500);
}
export function readBody(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new HttpError("invalid_request", "Send a JSON object body.", 400);
    }
    return payload;
}
// Never throws on a malformed body: the caller decides what is missing.
export async function readJson(request) {
    try {
        return await request.json();
    }
    catch {
        return {};
    }
}
export function requireUuid(value, field) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
        throw new HttpError("invalid_request", `A valid ${field} is required.`, 400);
    }
    return text;
}
export function requireCoordinate(value, field, limit) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) {
        throw new HttpError("invalid_request", `${field} is out of range.`, 400);
    }
    return parsed;
}
// ---------------------------------------------------------------------------
// environment and clients
// ---------------------------------------------------------------------------
export function env(name) {
    const value = Deno.env.get(name);
    if (!value) {
        throw new HttpError("unexpected", `${name} is not configured for this function.`, 500);
    }
    return value;
}
export function serviceClient() {
    return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
// Resolves the caller from their own access token. The publishable (anon) key
// is used for this lookup only; every table read or write afterwards goes
// through the service-role client.
export async function requireUser(request) {
    const authorization = request.headers.get("Authorization") || request.headers.get("authorization");
    if (!authorization?.toLowerCase().startsWith("bearer ")) {
        throw new HttpError("unauthorized", undefined, 401);
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
        throw new HttpError("unauthorized", undefined, 401);
    }
    return data.user;
}
// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------
// A QR payload is 32 random bytes, base64url encoded. Only its SHA-256 digest
// ever reaches the database, so the raw value exists exactly once: on the
// student's screen, until the session ends (spec sections 7 to 11).
export function createRawToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashToken(raw) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
export function requireRawToken(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length < 16 || text.length > 512) {
        throw new HttpError("invalid_request", "A QR payload is required.", 400);
    }
    return text;
}
// ---------------------------------------------------------------------------
// distance
// ---------------------------------------------------------------------------
// The same great-circle formula the UI uses for display, but this copy is the
// one that decides: the browser value is never trusted (spec section 30).
export function haversineMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
    const earthRadius = 6_371_000;
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const deltaLatitude = toRadians(latitudeB - latitudeA);
    const deltaLongitude = toRadians(longitudeB - longitudeA);
    const a = Math.sin(deltaLatitude / 2) ** 2 +
        Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function toNumber(value) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}
// Mirrors public.attendance_session_state() in the database.
export function sessionState(status, startsAt, endsAt) {
    if (status === "cancelled")
        return "cancelled";
    const start = Date.parse(startsAt);
    const end = Date.parse(endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end))
        return "closed";
    const now = Date.now();
    if (now < start)
        return "upcoming";
    if (now >= start && now < end)
        return "active";
    return "closed";
}
export function toSessionSummary(session) {
    return {
        id: session.id,
        event_id: session.event_id,
        name: session.name,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        latitude: toNumber(session.latitude),
        longitude: toNumber(session.longitude),
        allowed_radius: Number(session.allowed_radius),
        status: session.status,
        state: sessionState(session.status, session.starts_at, session.ends_at),
    };
}
export async function loadEvent(service, eventId) {
    const { data, error } = await service
        .from("events")
        .select("id, name, status, latitude, longitude, allowed_radius")
        .eq("id", eventId)
        .maybeSingle();
    if (error)
        throw new HttpError("unexpected", error.message, 500);
    if (!data)
        throw new HttpError("invalid_request", "That event no longer exists.", 404);
    return data;
}
export async function listSessions(service, eventId) {
    const { data, error } = await service
        .from("attendance_sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("starts_at", { ascending: true });
    if (error)
        throw new HttpError("unexpected", error.message, 500);
    return (data || []);
}
// The one session that is open right now, on the database clock. A cancelled
// session never counts, even inside its window.
export function findOpenSession(sessions) {
    return (sessions.find((session) => sessionState(session.status, session.starts_at, session.ends_at) === "active") ?? null);
}
export function findNextSession(sessions) {
    const upcoming = sessions
        .filter((session) => sessionState(session.status, session.starts_at, session.ends_at) === "upcoming")
        .sort((first, second) => Date.parse(first.starts_at) - Date.parse(second.starts_at));
    return upcoming[0] ?? null;
}
export async function loadRegistration(service, eventId, studentId) {
    const { data, error } = await service
        .from("event_registrations")
        .select("id, status, registered_at, cancelled_at")
        .eq("event_id", eventId)
        .eq("student_id", studentId)
        .maybeSingle();
    if (error)
        throw new HttpError("unexpected", error.message, 500);
    return data ?? null;
}
export async function hasAttended(service, sessionId, studentId) {
    const { count, error } = await service
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("attendance_session_id", sessionId)
        .eq("student_id", studentId)
        .eq("status", "present");
    if (error)
        throw new HttpError("unexpected", error.message, 500);
    return Boolean(count);
}
// Scanner rights come from public.attendance_scanners only (spec section 14).
export async function assertScanner(service, eventId, userId) {
    const { count, error } = await service
        .from("attendance_scanners")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("user_id", userId);
    if (error)
        throw new HttpError("unexpected", error.message, 500);
    if (!count)
        throw new HttpError("forbidden", FAILURE_MESSAGES.SCANNER_NOT_AUTHORIZED, 403);
}
export function isEventAcceptingAttendance(event) {
    return event.status === "published" || event.status === "ongoing";
}
// The student's own device position is the only one trusted, and only while it
// is fresh: the panel re-reports it every 60 seconds, comfortably inside the
// 90 second window.
export function checkLocation(token, session) {
    const latitude = toNumber(token.latitude);
    const longitude = toNumber(token.longitude);
    const reportedAt = Date.parse(String(token.location_updated_at ?? ""));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(reportedAt)) {
        return { ok: false, code: "LOCATION_MISSING" };
    }
    if (Date.now() - reportedAt > LOCATION_FRESHNESS_MS) {
        return { ok: false, code: "LOCATION_STALE" };
    }
    const allowedRadius = toNumber(session.allowed_radius);
    const distance = haversineMeters(latitude, longitude, toNumber(session.latitude), toNumber(session.longitude));
    if (distance > allowedRadius) {
        return { ok: false, code: "OUT_OF_RADIUS", distance, allowedRadius };
    }
    return { ok: true, distance, allowedRadius };
}
export function roundMeters(value) {
    if (!Number.isFinite(value))
        return value;
    return Math.round(value * 100) / 100;
}
