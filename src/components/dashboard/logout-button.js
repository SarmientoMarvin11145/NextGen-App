"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";

export default function LogoutButton({ compact = false }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={`group flex items-center gap-3 rounded-xl font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 ${
        compact ? "h-10 w-10 justify-center" : "w-full px-3 py-2.5"
      }`}
      aria-label="Sign out"
      title="Sign out"
    >
      <Icon
        name="logout"
        className={`h-4.5 w-4.5 shrink-0 ${pending ? "animate-pulse" : ""}`}
      />
      {!compact ? <span>{pending ? "Signing out..." : "Sign out"}</span> : null}
    </button>
  );
}