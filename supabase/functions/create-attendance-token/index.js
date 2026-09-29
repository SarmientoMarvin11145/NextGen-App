// create-attendance-token (spec sections 7 to 12, 19).
//
// Mints the student's single-session QR payload. The raw token is returned to
// the caller exactly once; only its SHA-256 digest is stored. A token is only
// issued when a session is open RIGHT NOW on the database clock, the student is
// registered, and the student has not already attended that session.
import { HttpError, FAILURE_MESSAGES, MAX_TOKEN_LIFETIME_MS, corsPreflight, createRawToken, findOpenSession, hasAttended, hashToken, handleError, isEventAcceptingAttendance, jsonResponse, listSessions, loadEvent, loadRegistration, readBody, readJson, requireUser, requireUuid, serviceClient, toSessionSummary, } from "../_shared/attendance.js";
Deno.serve(async (request) => {
    if (request.method === "OPTIONS")
        return corsPreflight();
    if (request.method !== "POST") {
        return jsonResponse({ error: "invalid_request", message: "POST is required." }, 405);
    }
    try {
        const user = await requireUser(request);
        const body = readBody(await readJson(request));
        const eventId = requireUuid(body.event_id, "event_id");
        const service = serviceClient();
        const event = await loadEvent(service, eventId);
        // A draft, completed, or cancelled event never mints a code. The student's
        // panel only asks while a session is open, so this is the belt to that
        // braces.
        if (!isEventAcceptingAttendance(event)) {
            throw new HttpError("no_active_session", "This event is not accepting attendance.", 409);
        }
        const registration = await loadRegistration(service, eventId, user.id);
        if (!registration || registration.status !== "registered") {
            throw new HttpError("not_registered", undefined, 403);
        }
        const sessions = await listSessions(service, eventId);
        const session = findOpenSession(sessions);
        if (!session) {
            throw new HttpError("no_active_session", undefined, 409);
        }
        if (await hasAttended(service, session.id, user.id)) {
            throw new HttpError("already_attended", undefined, 409);
        }
        // The token dies with the session window, and never outlives the hard cap.
        const sessionEnd = Date.parse(session.ends_at);
        const hardCap = Date.now() + MAX_TOKEN_LIFETIME_MS;
        const expiresAt = new Date(Number.isFinite(sessionEnd) ? Math.min(sessionEnd, hardCap) : hardCap).toISOString();
        const rawToken = createRawToken();
        const tokenHash = await hashToken(rawToken);
        // Upsert on (attendance_session_id, student_id): a reload rotates the code
        // instead of leaving the previous QR scannable.
        const { error: writeError } = await service.from("attendance_tokens").upsert({
            event_id: eventId,
            attendance_session_id: session.id,
            student_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt,
            used_at: null,
            latitude: null,
            longitude: null,
            location_updated_at: null,
        }, { onConflict: "attendance_session_id,student_id" });
        if (writeError) {
            // ON CONFLICT is pinned to (session, student), so the only other unique
            // index that can fire is the digest itself. That is a hash collision, not
            // a second attendance, so it must not be reported as one.
            if (writeError.code === "23505") {
                if (/token_hash/i.test(writeError.message)) {
                    throw new HttpError("unexpected", "The QR code could not be generated. Please try again.", 500);
                }
                throw new HttpError("already_attended", FAILURE_MESSAGES.already_attended, 409);
            }
            throw new HttpError("unexpected", writeError.message, 500);
        }
        return jsonResponse({
            ok: true,
            token: rawToken,
            expires_at: expiresAt,
            server_now: new Date().toISOString(),
            session: toSessionSummary(session),
            event: { id: event.id, name: event.name },
        }, 201);
    }
    catch (error) {
        return handleError(error);
    }
});
