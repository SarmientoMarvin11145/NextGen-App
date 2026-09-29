import { Icon } from "@/components/ui/icon";
import { tone as toneOf } from "@/lib/ui";

export function EmptyState({
  icon = "file",
  title,
  description,
  action = null,
  tone = "slate",
}) {
  const accent = toneOf(tone);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center sm:py-12">
      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${accent.soft}`}
      >
        <Icon name={icon} className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
