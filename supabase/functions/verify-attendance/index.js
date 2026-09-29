// verify-attendance (spec sections 14 to 22, 30).
//
// The scanner's single request. Every decision is made here, in this order:
//
//   1. the caller is an assigned scanner for the event
//   2. the raw token maps to a stored digest          -> TOKEN_NOT_FOUND
//   3. the token belongs to this event                -> EVENT_MISMATCH
//   4. the token has not expired                      -> TOKEN_EXPIRED
//   5. the token has not been used                    -> TOKEN_USED
//   6. the session window is open, on the DB clock    -> SESSION_NOT_ACTIVE
//   7. the event is accepting attendance              -> EVENT_NOT_ACTIVE
//   8. the student is registered                      -> NOT_REGISTERED
//   9. the student has not already attended           -> ALREADY_ATTENDED
//  10. a position was reported within 90 seconds      -> LOCATION_MISSING / LOCATION_STALE
//  11. that position is inside the session radius     -> OUT_OF_RADIUS
//
// Refusals are answered with HTTP 200 and { ok: false, code, message } so the
// scanner can show the reason, and the attempt is stored as a 'rejected' row so
// the admin report shows what was turned away and why.
import { HttpError, assertScanner, checkLocation, corsPreflight, findOpenSession, handleError, hashToken, hasAttended, isEventAcceptingAttendance, jsonResponse, listSessions, loadEvent, loadRegistration, readBody, readJson, rejection, requireRawToken, requireUser, requireUuid, roundMeters, serviceClient, sessionState, toNumber, } from "../_shared/attendance.js";
// Best effort: a refused scan should still be visible in the report, but a
// logging failure must never change the answer the scanner sees.
async function recordRejection(service, scannerId, token, code, extra = {}) {
    try {
        await service.from("attendance").insert({
            event_id: token.event_id,
            attendance_session_id: token.attendance_session_id,
            student_id: token.student_id,
            scanner_id: scannerId,
            status: "rejected",
            failure_code: code,
            student_latitude: Number.isFinite(toNumber(token.latitude)) ? toNumber(token.latitude) : null,
            student_longitude: Number.isFinite(toNumber(token.longitude)) ? toNumber(token.longitude) : null,
            distance_meters: typeof extra.distance_meters === "number" ? extra.distance_meters : null,
            allowed_radius: typeof extra.allowed_radius === "number" ? extra.allowed_radius : null,
            location_verified: false,
        });
    }
    catch {
        // Ignored on purpose.
    }
}
Deno.serve(async (request) => {
    if (request.method === "OPTIONS")
        return corsPreflight();
    if (request.method !== "POST") {
        return jsonResponse({ error: "invalid_request", message: "POST is required." }, 405);
    }
    try {
        const scanner = await requireUser(request);
        const body = readBody(await readJson(request));
        const rawToken = requireRawToken(body.token);
        const eventId = requireUuid(body.event_id, "event_id");
        const service = serviceClient();
        // 1. Only an account assigned to this event may verify for it.
        try {
            await assertScanner(service, eventId, scanner.id);
        }
        catch (error) {
            if (error instanceof HttpError && error.code === "forbidden") {
                return rejection("SCANNER_NOT_AUTHORIZED");
            }
            throw error;
        }
        // 2. The raw value is hashed and looked up; the code itself is never stored.
        const tokenHash = await hashToken(rawToken);
        const { data: tokenRow, error: tokenError } = await service
            .from("attendance_tokens")
            .select("id, event_id, attendance_session_id, student_id, expires_at, used_at, latitude, longitude, location_updated_at")
            .eq("token_hash", tokenHash)
            .maybeSingle();
        if (tokenError)
            throw new HttpError("unexpected", tokenError.message, 500);
        if (!tokenRow)
            return rejection("TOKEN_NOT_FOUND");
        const token = tokenRow;
        // 3. A code for another event must never record here.
        if (token.event_id !== eventId) {
            await recordRejection(service, scanner.id, token, "EVENT_MISMATCH");
            return rejection("EVENT_MISMATCH");
        }
        // 4. and 5. Single use, and dead once the window it was minted for closes.
        const expiresAt = Date.parse(String(token.expires_at));
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            await recordRejection(service, scanner.id, token, "TOKEN_EXPIRED");
            return rejection("TOKEN_EXPIRED");
        }
        if (token.used_at) {
            await recordRejection(service, scanner.id, token, "TOKEN_USED");
            return rejection("TOKEN_USED");
        }
        // 6. The session the token belongs to must exist and be open right now.
        const event = await loadEvent(service, eventId);
        const sessions = await listSessions(service, eventId);
        const session = sessions.find((item) => item.id === token.attendance_session_id) ?? null;
        if (!session) {
            await recordRejection(service, scanner.id, token, "TOKEN_NOT_FOUND");
            return rejection("TOKEN_NOT_FOUND");
        }
        if (!findOpenSession(sessions) || findOpenSession(sessions)?.id !== session.id) {
            await recordRejection(service, scanner.id, token, "SESSION_NOT_ACTIVE");
            return rejection("SESSION_NOT_ACTIVE");
        }
        if (sessionState(session.status, session.starts_at, session.ends_at) !== "active") {
            await recordRejection(service, scanner.id, token, "SESSION_NOT_ACTIVE");
            return rejection("SESSION_NOT_ACTIVE");
        }
        // 7. A cancelled or completed event stops accepting attendance.
        if (!isEventAcceptingAttendance(event)) {
            await recordRejection(service, scanner.id, token, "EVENT_NOT_ACTIVE");
            return rejection("EVENT_NOT_ACTIVE");
        }
        // 8. Registration is checked against the database, not the QR payload.
        const registration = await loadRegistration(service, eventId, token.student_id);
        if (!registration || registration.status !== "registered") {
            await recordRejection(service, scanner.id, token, "NOT_REGISTERED");
            return rejection("NOT_REGISTERED");
        }
        // 9. One attendance per student per session, guaranteed by a unique index.
        if (await hasAttended(service, session.id, token.student_id)) {
            await recordRejection(service, scanner.id, token, "ALREADY_ATTENDED");
            return rejection("ALREADY_ATTENDED");
        }
        // 10. and 11. The student's own fresh position must be inside the radius.
        const location = checkLocation(token, session);
        if (!location.ok) {
            const extra = {};
            if (typeof location.distance === "number") {
                extra.distance_meters = roundMeters(location.distance);
            }
            await recordRejection(service, scanner.id, token, location.code, extra);
            return rejection(location.code, extra);
        }
        // Everything passed: record the attendance with the student's position, the
        // measured distance, and the session radius, so the report is auditable.
        const distance = roundMeters(location.distance);
        const allowedRadius = roundMeters(location.allowedRadius);
        const recordedAt = new Date().toISOString();
        const { data: inserted, error: insertError } = await service
            .from("attendance")
            .insert({
            event_id: eventId,
            attendance_session_id: session.id,
            student_id: token.student_id,
            scanner_id: scanner.id,
            recorded_at: recordedAt,
            status: "present",
            failure_code: null,
            student_latitude: toNumber(token.latitude),
            student_longitude: toNumber(token.longitude),
            distance_meters: distance,
            allowed_radius: allowedRadius,
            location_verified: true,
        })
            .select("id, recorded_at")
            .single();
        if (insertError) {
            // The unique index is the last line of defence against two scanners
            // racing on the same student.
            if (insertError.code === "23505") {
                await recordRejection(service, scanner.id, token, "ALREADY_ATTENDED");
                return rejection("ALREADY_ATTENDED");
            }
            throw new HttpError("unexpected", insertError.message, 500);
        }
        // Burn the code so it can never be replayed, and so no further location
        // report is accepted for it.
        await service.from("attendance_tokens").update({ used_at: recordedAt }).eq("id", token.id);
        const { data: student } = await service
            .from("profiles")
            .select("full_name, email")
            .eq("id", token.student_id)
            .maybeSingle();
        return jsonResponse({
            ok: true,
            attendance_id: inserted?.id ?? null,
            recorded_at: inserted?.recorded_at ?? recordedAt,
            student_name: student?.full_name || student?.email || "Student",
            event_id: event.id,
            event_name: event.name,
            session_id: session.id,
            session_name: session.name,
            distance_meters: distance,
            allowed_radius: allowedRadius,
            location_verified: true,
        });
    }
    catch (error) {
        return handleError(error);
    }
});
