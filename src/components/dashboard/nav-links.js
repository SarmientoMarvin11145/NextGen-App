"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

function isActive(pathname, href) {
  if (href === "/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Desktop rows stay compact (40px) with a slim accent mark instead of a heavy
// icon tile, which keeps the sidebar quiet and lets the content lead.
export function DesktopNav({ items }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5" aria-label="Workspace">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition ${
              active
                ? "bg-blue-50 text-blue-900"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition ${
                active ? "bg-blue-600" : "bg-transparent group-hover:bg-slate-300"
              }`}
            />
            <Icon
              name={item.icon}
              className="h-4.5 w-4.5 shrink-0"
              strokeWidth={active ? 2.1 : 1.8}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile rows are 44px+ tall with a pill that appears behind the active icon,
// which reads clearly at thumb size without needing labels to shout.
export function MobileNav({ items }) {
  const pathname = usePathname();

  return (
    <div className="flex items-stretch gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold leading-none transition ${
              active ? "text-blue-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span
              className={`grid h-7 w-12 place-items-center rounded-full transition ${
                active ? "bg-blue-100/90" : "bg-transparent group-hover:bg-slate-100"
              }`}
            >
              <Icon name={item.icon} className="h-4.5 w-4.5" strokeWidth={active ? 2.2 : 1.7} />
            </span>
            <span className="w-full truncate text-center">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
