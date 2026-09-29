import Link from "next/link";
import { Icon } from "./icon";

export function Brand({ inverse = false, href = "/", showTagline = false }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-3" aria-label="NextGen home">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl shadow-sm ${
          inverse
            ? "bg-white/15 text-white ring-1 ring-white/20"
            : "bg-blue-600 text-white"
        }`}
      >
        <Icon name="sparkles" className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`text-[17px] font-bold tracking-[-0.03em] ${
            inverse ? "text-white" : "text-slate-950"
          }`}
        >
          Next<span className={inverse ? "text-blue-200" : "text-blue-600"}>Gen</span>
        </span>
        {showTagline ? (
          <span
            className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              inverse ? "text-blue-100/70" : "text-slate-400"
            }`}
          >
            Campus portal
          </span>
        ) : null}
      </span>
    </Link>
  );
}