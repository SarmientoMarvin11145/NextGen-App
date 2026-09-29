// CSV helpers for the admin attendance report (spec section 43).
// Everything is generated in the browser: no server round trip, no extra
// dependency, and the file appears through a temporary object URL.

const REPORT_HEADERS = [
  "Student",
  "Event",
  "Session",
  "Attendance Time",
  "Location",
  "Distance (m)",
  "Status",
  "Scanner",
];

function escapeCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // Prefixing =, +, -, @ keeps spreadsheet apps from treating a cell as a formula.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function buildAttendanceCsv(rows) {
  const lines = [REPORT_HEADERS.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.studentName,
        row.eventName,
        row.sessionName,
        row.recordedAtLabel,
        row.locationLabel,
        row.distanceMeters,
        row.statusLabel,
        row.scannerName,
      ]
        .map(escapeCell)
        .join(","),
    );
  }
  // CRLF is what Excel expects, and a leading BOM stops it mangling UTF-8.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
