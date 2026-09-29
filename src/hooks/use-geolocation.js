"use client";

// Browser Geolocation API state for the student QR screen.
//
// status: idle | locating | granted | denied | unsupported

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentPosition, isGeolocationSupported } from "@/lib/geolocation";

const IDLE = "idle";
const LOCATING = "locating";
const GRANTED = "granted";
const DENIED = "denied";
const UNSUPPORTED = "unsupported";

export function useGeolocation() {
  const [status, setStatus] = useState(IDLE);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [recordedAt, setRecordedAt] = useState(null);

  const pendingRef = useRef(false);

  useEffect(() => {
    if (!isGeolocationSupported()) {
      // Browser capability is only knowable after mount, and the answer never
      // changes, so an effect is the right place for this probe.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe
      setStatus(UNSUPPORTED);
      setError("This browser does not support location access.");
    }
  }, []);

  const request = useCallback(async () => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setStatus(LOCATING);
    setError(null);

    try {
      const position = await getCurrentPosition();
      setCoords(position);
      setRecordedAt(Date.now());
      setStatus(GRANTED);
      return position;
    } catch (requestError) {
      setCoords(null);
      setStatus(requestError?.code === "unsupported" ? UNSUPPORTED : DENIED);
      setError(requestError?.message || "Location is required to verify attendance.");
      return null;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  return {
    status,
    coords,
    error,
    recordedAt,
    request,
    isLocating: status === LOCATING,
    isGranted: status === GRANTED,
    isDenied: status === DENIED || status === UNSUPPORTED,
  };
}
