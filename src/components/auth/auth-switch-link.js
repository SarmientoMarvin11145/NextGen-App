"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

// Every auth screen shares one shell, so the corner link has to know which
// screen it is on. Signing in or registering offers the resend/verification
// screen (the usual reason someone is stuck here), and the verification screen
// offers the way back.
const SWITCHES = {
  "/login": { href: "/verify-email", label: "Verify your email", icon: "mailCheck" },
  "/register": { href: "/verify-email", label: "Verify your email", icon: "mailCheck" },
  "/verify-email": { href: "/login", label: "Back to sign in", icon: "arrowRight" },
};

export function AuthSwitchLink() {
  const pathname = usePathname();
  const target = SWITCHES[pathname] || SWITCHES["/login"];

  return (
    <Link
      href={target.href}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800"
    >
      <Icon name={target.icon} className="h-4 w-4" strokeWidth={1.9} />
      {target.label}
    </Link>
  );
}
