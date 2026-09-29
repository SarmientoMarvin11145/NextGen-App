import { Icon } from "@/components/ui/icon";
import { DISPLAY, MICRO, tone as toneOf } from "@/lib/ui";

// Shared heading used by every page below the dashboard shell so the mobile
// layout stays consistent: icon, eyebrow, title, then optional actions.
export function PageHeader({ eyebrow, title, description, icon = "grid", tone = "blue", actions }) {
  const accent = toneOf(tone);

  return (
    <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset sm:h-12 sm:w-12 ${accent.soft} ${accent.ring}`}
        >
          <Icon name={icon} className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          {eyebrow ? <p className={MICRO}>{eyebrow}</p> : null}
          <h1 className={`mt-1.5 ${DISPLAY}`}>{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2 sm:pt-1">{actions}</div> : null}
    </header>
  );
}
