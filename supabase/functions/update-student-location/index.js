// update-student-location (spec sections 17, 18, 20).
//
// The student's own device reports its position for the token currently on
// screen. Coordinates are written onto the token row, never onto the profile or
// the attendance record, and they are only valid for 90 seconds: the panel
// re-reports every 60 seconds while the QR is visible.
import { HttpError, corsPreflight, hashToken, handleError, jsonResponse, readBody, readJson, requireCoordinate, requireRawToken, requireUser, serviceClient, } from "../_shared/attendance.js";
Deno.serve(async (request) => {
    if (request.method === "OPTIONS")
        return corsPreflight();
    if (request.method !== "POST") {
        return jsonResponse({ error: "invalid_request", message: "POST is required." }, 405);
    }
    try {
        const user = await requireUser(request);
        const body = readBody(await readJson(request));
        const rawToken = requireRawToken(body.token);
        const latitude = requireCoordinate(body.latitude, "latitude", 90);
        const longitude = requireCoordinate(body.longitude, "longitude", 180);
        const service = serviceClient();
        const tokenHash = await hashToken(rawToken);
        const { data: token, error: readError } = await service
            .from("attendance_tokens")
            .select("id, student_id, expires_at, used_at")
            .eq("token_hash", tokenHash)
            .maybeSingle();
        if (readError)
            throw new HttpError("unexpected", readError.message, 500);
        if (!token)
            throw new HttpError("token_not_found", undefined, 404);
        // A token is personal: one student can never report a position for another
        // student's code.
        if (token.student_id !== user.id) {
            throw new HttpError("forbidden", "That QR code belongs to another student.", 403);
        }
        if (token.used_at)
            throw new HttpError("token_used", undefined, 409);
        const expiresAt = Date.parse(String(token.expires_at));
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            throw new HttpError("token_not_found", undefined, 410);
        }
        const recordedAt = new Date().toISOString();
        const { error: writeError } = await service
            .from("attendance_tokens")
            .update({
            latitude,
            longitude,
            location_updated_at: recordedAt,
        })
            .eq("id", token.id);
        if (writeError)
            throw new HttpError("unexpected", writeError.message, 500);
        return jsonResponse({ ok: true, recorded_at: recordedAt });
    }
    catch (error) {
        return handleError(error);
    }
});
