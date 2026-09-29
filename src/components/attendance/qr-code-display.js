"use client";

import { QRCodeSVG } from "qrcode.react";

// Renders the QR for the temporary attendance token that is passed in.
//
// No image is ever generated, stored, or uploaded: the SVG is drawn in the
// browser from the token string and disappears with the page (spec sections 9
// and 10). The payload is the token itself, never any student information.
export function QRCodeDisplay({ value, size = 232, title = "Attendance QR code" }) {
  if (!value) return null;

  return (
    <div className="inline-flex rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={2}
        bgColor="#FFFFFF"
        fgColor="#0f172a"
        title={title}
      />
    </div>
  );
}
