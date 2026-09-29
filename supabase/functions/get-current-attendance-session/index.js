// get-current-attendance-session (spec sections 12, 23, 45).
//
// The single read the student QR panel, the scanner workspace, and the
// notification feed use. It answers with the database clock, the caller's
// registration, every session of the event with its derived state, which
// session is open right now, which one opens next, and the caller's own
// recorded attendance.
//
// Nothing about another student is ever returned.
import { HttpError, corsPreflight, findNextSession, findOpenSession, handleError, jsonResponse, listSessions, loadEvent, loadRegistration, readBody, readJson, requireUser, requireUuid, serviceClient, toSessionSummary, } from "../_shared/attendance.js";
async function isAdmin(service, userId) {
    const { data } = await service.from("profiles").select("role").eq("id", userId).maybeSingle();
    return data?.role === "admin";
}
async function isScanner(service, eventId, userId) {
    const { count } = await service
        .from("attendance_scanners")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("user_id", userId);
    return Boolean(count);
}
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
        const registration = await loadRegistration(service, eventId, user.id);
        const [admin, scanner] = await Promise.all([
            isAdmin(service, user.id),
            isScanner(service, eventId, user.id),
        ]);
        // Mirrors the `events_select_visible` policy so this read can never expose
        // more than a direct table read would: a non-draft event is readable by
        // every signed-in account (that is how a student can view an event before
        // registering, and why the panel has an unregistered state at all), while a
        // draft stays limited to its administrators, its scanners, and anyone who
        // already holds a registration row.
        if (!registration && !admin && !scanner && event.status === "draft") {
            throw new HttpError("forbidden", "You are not allowed to view this event.", 403);
        }
        const sessions = await listSessions(service, eventId);
        const summaries = sessions.map(toSessionSummary);
        const openSession = findOpenSession(sessions);
        const nextSession = findNextSession(sessions);
        const { data: attendanceRows, error: attendanceError } = await service
            .from("attendance")
            .select("id, event_id, attendance_session_id, student_id, scanner_id, recorded_at, status, failure_code, distance_meters, allowed_radius, location_verified, student_latitude, student_longitude")
            .eq("event_id", eventId)
            .eq("student_id", user.id)
            .eq("status", "present")
            .order("recorded_at", { ascending: false });
        if (attendanceError)
            throw new HttpError("unexpected", attendanceError.message, 500);
        const attendance = attendanceRows || [];
        const attendedSessionIds = [
            ...new Set(attendance.map((row) => row.attendance_session_id).filter(Boolean)),
        ];
        return jsonResponse({
            ok: true,
            server_now: new Date().toISOString(),
            event: {
                id: event.id,
                name: event.name,
                status: event.status,
                latitude: Number(event.latitude),
                longitude: Number(event.longitude),
                allowed_radius: Number(event.allowed_radius),
            },
            registration,
            sessions: summaries,
            active_session_id: openSession?.id ?? null,
            next_session: nextSession ? toSessionSummary(nextSession) : null,
            attended_session_ids: attendedSessionIds,
            attendance,
            access: { admin, scanner },
        });
    }
    catch (error) {
        return handleError(error);
    }
});
