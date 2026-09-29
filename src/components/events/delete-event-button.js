"use client";

// Admin: delete an event (spec section 40).
//
// Deleting cascades to registrations, sessions, tokens, and attendance rows in
// the database, so the button always asks first and the confirmation is inline
// rather than a browser alert.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { BTN_MD, BTN_OUTLINE } from "@/lib/ui";

export function DeleteEventButton({ event, redirectTo = "/admin/events" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("events").delete().eq("id", event.id);
      if (deleteError) throw deleteError;

      router.push(redirectTo);
      router.refresh();
    } catch (removeError) {
      setError(removeError?.message || "The event could not be deleted.");
      setBusy(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
        <span className="text-xs font-semibold text-rose-700">
          Delete this event, its registrations, and all attendance records?
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="h-10 rounded-xl bg-rose-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete event"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="h-10 rounded-xl px-3 text-[13px] font-semibold text-rose-700 transition hover:bg-white disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${BTN_OUTLINE} ${BTN_MD} text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700`}
      >
        <Icon name="trash" className="h-4 w-4" strokeWidth={2} />
        Delete event
      </button>
      {error ? (
        <p role="alert" className="text-[12.5px] font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
