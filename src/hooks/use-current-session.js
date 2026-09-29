"use client";

// Resolves which attendance session is active using the DATABASE clock, then
// keeps a local countdown in sync without hammering the network.
//
// The Edge Function returns `server_now`. We convert that into an offset
// (server - device) and tick from it every second, so a student who has set
// their phone clock wrong still sees the real state, while the browser only
// polls every POLL_MS instead of once per second (spec sections 7, 12, 45).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAttendanceContext } from "@/lib/attendance";

const TICK_MS = 1000;
const POLL_MS = 30000;

export function useCurrentSession(eventId) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverNowMs, setServerNowMs] = useState(null);

  const offsetRef = useRef(null);
  const busyRef = useRef(false);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!eventId || busyRef.current) return;
      busyRef.current = true;
      if (!silent) setLoading(true);

      try {
        const next = await fetchAttendanceContext(eventId);
        setContext(next);
        setError(null);

        const parsed = next.serverNow ? Date.parse(next.serverNow) : NaN;
        if (Number.isFinite(parsed)) {
          offsetRef.current = parsed - Date.now();
          setServerNowMs(parsed);
        }
      } catch (refreshError) {
        setError(refreshError?.message || "Could not load attendance status.");
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    },
    [eventId],
  );

  // Initial load whenever the event changes.
  useEffect(() => {
    // Dropping the previous event's context before the new read settles is the
    // only way a hook can discard state that belongs to an older input.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on event change
    setContext(null);
    setLoading(true);
    offsetRef.current = null;
    refresh();
  }, [refresh]);

  // One second tick derived from the last known server offset.
  useEffect(() => {
    if (offsetRef.current === null) return undefined;
    const timer = setInterval(() => {
      setServerNowMs(Date.now() + offsetRef.current);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [context]);

  // Periodic silent refresh so session transitions and new attendance rows are
  // picked up even if the realtime channel drops.
  useEffect(() => {
    if (!eventId) return undefined;
    const timer = setInterval(() => refresh({ silent: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [eventId, refresh]);

  const sessions = context?.sessions ?? [];
  const activeSession =
    sessions.find((session) => session.id === context?.activeSessionId) ?? null;

  return {
    context,
    loading,
    error,
    serverNowMs,
    sessions,
    activeSession,
    nextSession: context?.nextSession ?? null,
    registration: context?.registration ?? null,
    attendedSessionIds: context?.attendedSessionIds ?? [],
    attendance: context?.attendance ?? [],
    refresh,
  };
}
