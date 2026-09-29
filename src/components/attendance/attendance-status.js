import { Icon } from "@/components/ui/icon";

// Status vocabulary from spec section 55: UPCOMING, AVAILABLE, ATTENDED,
// EXPIRED, REJECTED. One component so every surface uses the same words and
// the same colours.
const STATE_CONFIG = {
  upcoming: { label: "Upcoming", className: "bg-amber-50 text-amber-700 ring-amber-100", icon: "clock" },
  active: { label: "Available", className: "bg-blue-50 text-blue-700 ring-blue-100", icon: "qr" },
  closed: { label: "Expired", className: "bg-slate-100 text-slate-600 ring-slate-200", icon: "clock" },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-100", icon: "x" },
  attended: { label: "Attended", className: "bg-emerald-50 text-emerald-700 ring-emerald-100", icon: "check" },
  rejected: { label: "Rejected", className: "bg-rose-50 text-rose-700 ring-rose-100", icon: "x" },
  registered: { label: "Registered", className: "bg-blue-50 text-blue-700 ring-blue-100", icon: "check" },
};

export function AttendanceStatus({
  state = "upcoming",
  attended = false,
  rejected = false,
  showIcon = true,
  size = "md",
  className = "",
}) {
  const config = attended
    ? STATE_CONFIG.attended
    : rejected
      ? STATE_CONFIG.rejected
      : STATE_CONFIG[state] || STATE_CONFIG.upcoming;

  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-[10.5px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${sizing} ${config.className} ${className}`}
    >
      {showIcon ? (
        <Icon
          name={config.icon}
          className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}
          strokeWidth={2.4}
        />
      ) : null}
      {config.label}
    </span>
  );
}

// Plain text variant for dense tables where a pill would be too heavy.
export function AttendanceStatusText({ state = "upcoming", attended = false, rejected = false }) {
  const config = attended
    ? STATE_CONFIG.attended
    : rejected
      ? STATE_CONFIG.rejected
      : STATE_CONFIG[state] || STATE_CONFIG.upcoming;

  return (
    <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${config.className.split(" ").slice(1, 3).join(" ")}`}>
      {config.label}
    </span>
  );
}
