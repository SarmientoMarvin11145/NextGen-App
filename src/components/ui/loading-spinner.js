import { Icon } from "@/components/ui/icon";

// Spinner used for every loading state in the app so pending feedback looks
// identical on the student, scanner, and admin surfaces.
export function LoadingSpinner({ label = "Loading", size = "md", className = "" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-9 w-9 border-[3px]",
  };

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} role="status">
      <span
        aria-hidden="true"
        className={`${sizes[size] || sizes.md} animate-spin rounded-full border-slate-200 border-t-blue-600`}
      />
      <span className="text-sm font-medium text-slate-500">{label}</span>
    </span>
  );
}

// Centred block variant for full panel loading states.
export function LoadingPanel({ label = "Loading", icon = "loader" }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm">
        <Icon name={icon} className="h-5 w-5 animate-spin" strokeWidth={1.9} />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-800">{label}</p>
    </div>
  );
}
