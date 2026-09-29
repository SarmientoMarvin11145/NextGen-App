// Thin wrappers around the four attendance Edge Functions plus the human copy
// for every failure they can report. Every call in this file goes through
// invokeEdgeFunction(), so the caller is always the signed-in student or
// scanner and no service-role key is ever present in the browser bundle.

import { invokeEdgeFunction } from "@/lib/supabase/edge";
import { getAttendanceFailureMessage } from "@/lib/events";

// A failure that carries a machine readable code plus a sentence that is safe
// to render verbatim. All four functions below can throw one.
export class AttendanceError extends Error {
  constructor(code, message) {
    super(message || getAttendanceFailureMessage(code));
    this.name = "AttendanceError";
    this.code = code || "unknown";
  }
}

function toAttendanceError(error) {
  if (error instanceof AttendanceError) return error;
  return new AttendanceError(error?.code || "unknown", error?.message);
}

/**
 * Reads the authoritative view of an event's attendance state.
 *
 * Resolves against the database clock and returns:
 *   server_now, registration, sessions (each with a derived `state`),
 *   active_session_id, next_session, attended_session_ids, attendance.
 */
export async function fetchAttendanceContext(eventId) {
  try {
    const payload = await invokeEdgeFunction("get-current-attendance-session", {
      event_id: eventId,
    });
    return {
      serverNow: payload?.server_now ?? null,
      registration: payload?.registration ?? null,
      sessions: payload?.sessions ?? [],
      activeSessionId: payload?.active_session_id ?? null,
      nextSession: payload?.next_session ?? null,
      attendedSessionIds: payload?.attended_session_ids ?? [],
      attendance: payload?.attendance ?? [],
    };
  } catch (error) {
    throw toAttendanceError(error);
  }
}

/**
 * Mints a fresh single-session token for whatever session is active *right
 * now*. The raw token is returned exactly once and never stored on the client
 * beyond the lifetime of the QR on screen (spec sections 7 to 11).
 */
export async function mintAttendanceToken(eventId) {
  try {
    const payload = await invokeEdgeFunction("create-attendance-token", {
      event_id: eventId,
    });
    return { token: payload.token, session: payload.session };
  } catch (error) {
    throw toAttendanceError(error);
  }
}

/**
 * Reports the student's own device coordinates for the token currently on
 * screen. Must be refreshed faster than the Edge Function's 90 second
 * freshness window while the QR stays visible.
 */
export async function reportStudentLocation(token, { latitude, longitude }) {
  try {
    return await invokeEdgeFunction("update-student-location", {
      token,
      latitude,
      longitude,
    });
  } catch (error) {
    throw toAttendanceError(error);
  }
}

/**
 * The scanner's single verification request. The Edge Function performs every
 * check in order and returns { ok: true, ... } or { ok: false, code, message }.
 * This wrapper normalises both shapes so callers only deal with a result object.
 */
export async function verifyAttendance(token, eventId) {
  let payload;
  try {
    payload = await invokeEdgeFunction("verify-attendance", {
      token,
      event_id: eventId,
    });
  } catch (error) {
    throw toAttendanceError(error);
  }

  if (payload?.ok) {
    return {
      ok: true,
      studentName: payload.student_name ?? "Student",
      sessionName: payload.session_name ?? "",
      recordedAt: payload.recorded_at ?? null,
      distanceMeters: payload.distance_meters ?? null,
      allowedRadius: payload.allowed_radius ?? null,
      locationVerified: Boolean(payload.location_verified),
    };
  }

  const code = payload?.code || payload?.error || "unknown";
  return {
    ok: false,
    code,
    message: payload?.message || getAttendanceFailureMessage(code),
    distanceMeters: payload?.distance_meters ?? null,
  };
}

// Realtime subscription helper: keeps a student's dashboard in sync with new
// attendance rows without polling (spec section 44).
export function subscribeToAttendance(supabase, filter, onChange) {
  const channel = supabase
    .channel(`attendance-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "attendance", filter },
      (payload) => onChange?.(payload.new),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
