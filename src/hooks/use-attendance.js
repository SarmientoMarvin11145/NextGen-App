"use client";

// Orchestrates everything the student QR screen needs:
//   1. which session is active (database clock)
//   2. a short-lived token for that session
//   3. continuous reporting of the student's own device location
//   4. realtime refresh when attendance is recorded
//
// The QR is only usable once a token exists AND the device has reported a
// position, because verify-attendance rejects tokens with no coordinates
// (spec sections 17, 18, 20).

import { useCallback, useEffect, useRef, useState } from "react";
import { mintAttendanceToken, reportStudentLocation } from "@/lib/attendance";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useCurrentSession } from "./use-current-session";
import { useGeolocation } from "./use-geolocation";

// Well inside the Edge Function's 90 second freshness window.
const LOCATION_REFRESH_MS = 60_000;

export function useAttendance(eventId, studentId) {
  const current = useCurrentSession(eventId);
  const geolocation = useGeolocation();

  const [token, setToken] = useState(null);
  const [tokenSessionId, setTokenSessionId] = useState(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState(null);

  const [reporting, setReporting] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [locationReportedAt, setLocationReportedAt] = useState(null);

  const attemptedSessionRef = useRef(null);
  const reportingRef = useRef(false);

  const { activeSession, registration, attendedSessionIds, refresh } = current;
  const activeSessionId = activeSession?.id ?? null;
  const isRegistered = registration?.status === "registered";
  const attended = activeSessionId ? attendedSessionIds.includes(activeSessionId) : false;

  // A token belongs to exactly one session: drop it as soon as that session
  // ends so a stale QR can never render for the next window.
  useEffect(() => {
    // A new session means every value below belongs to the previous window.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on session change
    setToken(null);
    setTokenSessionId(null);
    setMintError(null);
    setLocationError(null);
    setLocationReportedAt(null);
    attemptedSessionRef.current = null;
  }, [activeSessionId]);

  const mint = useCallback(
    async ({ force = false } = {}) => {
      if (!eventId || !activeSessionId || !isRegistered || attended) return null;
      if (!force && attemptedSessionRef.current === activeSessionId) return null;

      attemptedSessionRef.current = activeSessionId;
      setMinting(true);
      setMintError(null);

      try {
        const result = await mintAttendanceToken(eventId);
        setToken(result.token);
        setTokenSessionId(activeSessionId);
        return result.token;
      } catch (error) {
        setToken(null);
        setMintError(error?.message || "Could not create your QR code.");
        return null;
      } finally {
        setMinting(false);
      }
    },
    [eventId, activeSessionId, isRegistered, attended],
  );

  // Mint once per active session, automatically.
  useEffect(() => {
    if (!eventId || !activeSessionId || !isRegistered || attended) return;
    // mint() turns its own busy flag on before it awaits the Edge Function, so
    // the spinner is already on screen while the request is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mint() owns its flags
    mint();
  }, [eventId, activeSessionId, isRegistered, attended, mint]);

  // Ask the device for a fresh fix and push it to the token row. Repeats while
  // the QR is on screen so coordinates never age past the freshness window.
  const syncLocation = useCallback(
    async ({ currentToken = token } = {}) => {
      if (!currentToken || reportingRef.current) return false;
      reportingRef.current = true;
      setReporting(true);

      try {
        const position = await geolocation.request();
        if (!position) {
          setLocationError(
            geolocation.error || "Location permission is required to verify attendance.",
          );
          return false;
        }
        await reportStudentLocation(currentToken, position);
        setLocationReportedAt(Date.now());
        setLocationError(null);
        return true;
      } catch (error) {
        setLocationError(error?.message || "Could not share your location.");
        return false;
      } finally {
        reportingRef.current = false;
        setReporting(false);
      }
    },
    [token, geolocation],
  );

  useEffect(() => {
    if (!token) return undefined;
    // Same shape as mint(): the reporting flag is set before the browser asks
    // for a position, so the panel can show that it is working.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncLocation() owns its flags
    syncLocation({ currentToken: token });
    const timer = setInterval(() => syncLocation({ currentToken: token }), LOCATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [token, syncLocation]);

  // Realtime: the Edge Function inserts the attendance row, Supabase streams
  // it back, and the panel flips to "Attended" without a manual refresh.
  useEffect(() => {
    if (!studentId || !eventId || !isSupabaseConfigured()) return undefined;

    let supabase;
    let channel;
    try {
      supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel(`attendance-watch-${eventId}-${studentId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "attendance",
            filter: `student_id=eq.${studentId}`,
          },
          () => {
            setToken(null);
            refresh({ silent: true });
          },
        )
        .subscribe();
    } catch {
      return undefined;
    }

    return () => {
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [studentId, eventId, refresh]);

  return {
    ...current,
    isRegistered,
    attended,
    token,
    tokenSessionId,
    minting,
    mintError,
    retryMint: () => mint({ force: true }),
    // Ready means: registered + active session + not attended + token on
    // screen + a location the backend can verify.
    isReady: Boolean(token) && !locationError && Boolean(locationReportedAt) && !attended,
    tokenReady: Boolean(token),
    reporting,
    locationReady: Boolean(locationReportedAt) && !locationError,
    locationReportedAt,
    locationError,
    syncLocation,
    geolocation,
    retry: () => refresh(),
  };
}

