import { Icon } from "@/components/ui/icon";
import { MICRO, PANEL_LG, TITLE_LG, tone as toneOf } from "@/lib/ui";

// White card with a small header. Used for every content section so spacing,
// borders, and radii stay identical across the admin and student workspaces.
export function SectionCard({
  id,
  eyebrow,
  title,
  description,
  icon,
  tone = "blue",
  badge,
  children,
  className = "",
}) {
  const accent = toneOf(tone);

  return (
    <section id={id} className={`scroll-mt-24 ${PANEL_LG} p-4 sm:p-5 lg:p-6 ${className}`}>
      {title ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent.soft}`}
              >
                <Icon name={icon} className="h-4.5 w-4.5" strokeWidth={1.9} />
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className={MICRO}>{eyebrow}</p> : null}
              <h2 className={`mt-1 ${TITLE_LG}`}>{title}</h2>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}
      <div className={title ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "blue" }) {
  const accent = toneOf(tone);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${accent.soft}`}
    >
      {children}
    </span>
  );
}
