"use client";

// Camera preview + QR decoding via html5-qrcode (spec sections 14, 15, 21).
//
// html5-qrcode renders its own <video> inside the element it is handed and
// keeps the camera stream open until stop() runs. Two consequences shape this
// file:
//   - the library is imported dynamically, so nothing that touches `document`
//     or `navigator` runs while the component is rendered on the server, and
//   - the region id comes from useId(), so two open scanners can never fight
//     over the same element.
//
// The reader asks for the rear-facing camera (facingMode "environment") so a
// phone can scan a student's screen. The scan callback is held in a ref so
// finishing a scan never depends on a parent re-render.

import { useEffect, useId, useRef, useState } from "react";

// Long enough that a single QR is not submitted several times while the video
// frame is still being decoded.
const COOLDOWN_MS = 2500;

// Html5QrcodeScannerState.NOT_STARTED from html5-qrcode. In that state the
// scanner holds no camera, and stop() throws instead of releasing one.
const SCANNER_NOT_STARTED = 1;

// html5-qrcode reports camera failures as plain strings, for example
// "Error getting userMedia, error = NotAllowedError: Permission denied", so the
// lookup is a substring match instead of a check of error.code.
const CAMERA_MESSAGES = [
  {
    match: "NotAllowedError",
    message: "Camera permission was denied. Allow camera access to scan QR codes.",
  },
  {
    match: "Permission denied",
    message: "Camera permission was denied. Allow camera access to scan QR codes.",
  },
  { match: "NotFoundError", message: "No camera was found on this device." },
  { match: "Requested device not found", message: "No camera was found on this device." },
  {
    match: "NotReadableError",
    message: "The camera is already in use by another application.",
  },
  {
    match: "Could not start video source",
    message: "The camera is already in use by another application.",
  },
  {
    match: "OverconstrainedError",
    message: "This camera does not support the required video mode.",
  },
  { match: "SecurityError", message: "Camera access requires a secure (HTTPS) connection." },
  { match: "secure context", message: "Camera access requires a secure (HTTPS) connection." },
  {
    match: "not supported",
    message:
      "This browser cannot stream camera video. Open the scanner on a phone or another browser.",
  },
];

const FALLBACK_MESSAGE =
  "The camera could not be started. Check the camera permission for this site and try again.";

function describeCameraError(error) {
  const text = typeof error === "string" ? error : error?.message || String(error ?? "");
  const known = CAMERA_MESSAGES.find((entry) => text.includes(entry.match));
  return known ? known.message : FALLBACK_MESSAGE;
}

// stop() throws when the scanner is not running, and clear() can run after React
// has already removed the region, so both steps are guarded separately.
async function releaseScanner(scanner) {
  if (!scanner) return;
  try {
    if (scanner.getState() !== SCANNER_NOT_STARTED) await scanner.stop();
  } catch {
    // The stream was already released.
  }
  try {
    scanner.clear();
  } catch {
    // The region is already unmounted.
  }
}

export function QRScanner({ active, onScan }) {
  // The camera is mounted only while it is wanted, so every piece of camera
  // state starts fresh each time it opens: no effect has to reset anything.
  if (!active) return null;
  return <CameraView onScan={onScan} />;
}

function CameraView({ onScan }) {
  // React generates the id, so the region stays unique even when a page mounts
  // more than one scanner (an officer's phone and a kiosk tablet, for instance).
  const regionId = `qr-scanner-region-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const scannerRef = useRef(null);
  const scanRef = useRef(null);
  const busyRef = useRef(false);

  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    scanRef.current = typeof onScan === "function" ? onScan : null;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const start = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        scanner = new Html5Qrcode(regionId, {
          verbose: false,
          // Only QR codes are decoded: the narrower format list is also the
          // faster path on a mid-range phone.
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            // The viewfinder square follows the video size instead of a
            // hard-coded box, so it stays inside the frame on any screen.
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
              return { width: edge, height: edge };
            },
          },
          (decodedText) => {
            if (cancelled || busyRef.current) return;
            const text = String(decodedText ?? "").trim();
            if (!text) return;
            busyRef.current = true;
            scanRef.current?.(text);
            window.setTimeout(() => {
              busyRef.current = false;
            }, COOLDOWN_MS);
          },
          // "No QR code found in this frame" arrives through this callback on
          // every frame, so it has to stay silent.
          () => {},
        );

        if (cancelled) {
          await releaseScanner(scanner);
          return;
        }
        setStarting(false);
      } catch (cameraError) {
        if (cancelled) return;
        setError(describeCameraError(cameraError));
        setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      busyRef.current = false;
      void releaseScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [regionId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
      {/* The wrapper, not the region, owns the overlays: html5-qrcode wipes the
          region's contents with innerHTML when it starts and stops, so React
          must never render children into it. */}
      <div className="relative min-h-[300px] w-full">
        <div id={regionId} className="w-full" />

        {starting ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-center">
            <p className="text-sm font-medium text-white">Starting camera…</p>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/85 px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-white">Camera unavailable</p>
              <p className="mt-2 text-[13px] leading-5 text-slate-300">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      <p className="px-4 py-3 text-center text-[13px] font-medium text-slate-300">
        Point the camera at the student&apos;s QR code
      </p>
    </div>
  );
}
