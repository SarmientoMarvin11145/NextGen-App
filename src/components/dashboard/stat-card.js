import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { MICRO, PANEL, VALUE, tone as toneOf } from "@/lib/ui";

// One metric card for both workspaces. Keeping the student and admin overview
// numbers in a single component is what makes the two dashboards feel like the
// same product.
export function StatCard({ icon, label, value, detail, tone = "blue", href }) {
  const accent = toneOf(tone);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={MICRO}>{label}</p>
          <p className={`mt-2.5 truncate ${VALUE}`}>{value}</p>
          {detail ? <p className="mt-1 truncate text-xs font-medium text-slate-500">{detail}</p> : null}
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent.soft}`}>
          <Icon name={icon} className="h-5 w-5" strokeWidth={1.9} />
        </span>
      </div>
      {href ? (
        <span className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 transition group-hover:text-blue-700">
          View
          <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`group block ${PANEL} p-4 transition hover:border-blue-200/80 sm:p-5`}>
        {content}
      </Link>
    );
  }

  return <div className={`${PANEL} p-4 sm:p-5`}>{content}</div>;
}
