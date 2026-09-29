// Presentation helpers shared by the student, scanner, and admin surfaces.
//
// Two kinds of time exist in the schema:
//   * event_date / start_time / end_time  -> display only, no timezone maths
//   * starts_at / ends_at (timestamptz)    -> the authoritative window
// Everything visible to a human uses the first set; everything security
// relevant uses the second, always compared against the database clock.

export const EVENT_STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const EVENT_STATUS_TONES = {
  draft: "slate",
  published: "blue",
  ongoing: "violet",
  completed: "slate",
  cancelled: "rose",
};

export const REGISTRATION_STATUS_LABELS = {
  registered: "Registered",
  cancelled: "Cancelled",
  waitlist: "Waitlist",
};

// Session "status" in the database is only scheduled/cancelled; upcoming,
// active, and closed are derived from now() by attendance_session_state().
export const SESSION_STATE_LABELS = {
  upcoming: "Upcoming",
  active: "Available",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const SESSION_STATE_TONES = {
  upcoming: "amber",
  active: "blue",
  closed: "slate",
  cancelled: "rose",
};

export function eventStatusLabel(status) {
  return EVENT_STATUS_LABELS[status] || status || "—";
}

export function eventStatusTone(status) {
  return EVENT_STATUS_TONES[status] || "slate";
}

export function sessionStateLabel(state) {
  return SESSION_STATE_LABELS[state] || state || "—";
}

export function sessionStateTone(state) {
  return SESSION_STATE_TONES[state] || "slate";
}

// "08:00:00" | "08:00" -> "8:00 AM"
export function formatClockTime(value) {
  if (!value) return "—";
  const parts = String(value).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(Number.isFinite(minute) ? minute : 0).padStart(2, "0")} ${suffix}`;
}

// "2026-10-15" -> "Thu, Oct 15, 2026". Parsed as a local wall-clock date so
// the calendar day can never shift backwards across timezones.
export function formatEventDate(value) {
  if (!value) return "—";
  const raw = String(value);
  const date = raw.includes("T") ? new Date(raw) : new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatSessionWindow(session) {
  if (!session) return "—";
  return `${formatClockTime(session.start_time)} – ${formatClockTime(session.end_time)}`;
}

// Group sessions by their calendar day so a two day event reads as two blocks.
export function groupSessionsByDate(sessions = []) {
  const groups = [];
  for (const session of sessions) {
    const key = session.session_date || "";
    const existing = groups.find((group) => group.date === key);
    if (existing) {
      existing.sessions.push(session);
    } else {
      groups.push({ date: key, sessions: [session] });
    }
  }
  return groups;
}

// "01:32:15"; never returns a negative value so the UI cannot flash "-00:00:01".
export function formatCountdown(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "00:00:00";
  const total = Math.floor(milliseconds / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------

export function getSlotsLabel(event, registeredCount) {
  if (!event?.max_participants) {
    return `${registeredCount} registered`;
  }
  const remaining = Math.max(0, event.max_participants - registeredCount);
  if (remaining === 0) return "Event full";
  return `${remaining} of ${event.max_participants} slots left`;
}

export function getRemainingSlots(event, registeredCount) {
  if (!event?.max_participants) return null;
  return Math.max(0, event.max_participants - registeredCount);
}

// Mirrors the checks enforced by the enforce_registration_rules trigger so the
// button can be disabled before the student taps it. The database remains the
// authority: this only avoids a pointless round trip.
export function getRegistrationBlockReason(event, registeredCount) {
  if (!event) return "Event unavailable.";
  if (event.status === "draft") return "This event has not been published yet.";
  if (event.status === "cancelled") return "This event was cancelled.";
  if (event.status === "completed") return "Registration for this event has closed.";
  if (
    event.registration_deadline &&
    Date.parse(event.registration_deadline) < Date.now()
  ) {
    return "The registration deadline has passed.";
  }
  if (
    event.max_participants &&
    typeof registeredCount === "number" &&
    registeredCount >= event.max_participants
  ) {
    return "This event has reached its participant limit.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session state copy
// ---------------------------------------------------------------------------

// Failure codes returned by the verify-attendance Edge Function, mapped to the
// copy shown on the scanner result screen (spec section 22). Only user safe
// sentences live here; internal details stay in the Edge Function.
export const ATTENDANCE_FAILURE_MESSAGES = {
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
  // Edge Function HTTP failures use the `error` field instead of a code.
  unauthorized: "Your session has expired. Please sign in again.",
  not_registered: "You are not registered for this event.",
  no_active_session: "There is no active attendance session right now.",
  already_attended: "You have already attended this session.",
  session_not_active: "This attendance session is not active right now.",
  token_used: "This QR code was already used.",
  token_not_found: "QR code is not valid or has already rotated.",
  forbidden: "You are not allowed to perform this action.",
  network: "Could not reach the server. Check your connection and try again.",
};

export function getAttendanceFailureMessage(code) {
  if (!code) return "Attendance could not be recorded.";
  return ATTENDANCE_FAILURE_MESSAGES[code] || "Attendance could not be recorded.";
}

// Compact status copy for a session state, used by the timeline and the
// student QR panel.
export function getStateCopy(state) {
  switch (state) {
    case "upcoming":
      return { label: "Upcoming", hint: "Opens at the scheduled time" };
    case "active":
      return { label: "Available", hint: "Show your QR code to a scanner" };
    case "closed":
      return { label: "Closed", hint: "This session has ended" };
    case "cancelled":
      return { label: "Cancelled", hint: "This session was cancelled" };
    default:
      return { label: "—", hint: "" };
  }
}

