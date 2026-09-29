"use client";

// Register / cancel a student's place on an event (spec section 5).
//
// Writes go straight to `event_registrations` under RLS: the INSERT policy
// only allows your own row with status 'registered', and the database trigger
// owns the deadline and capacity rules, so nothing here can be trusted for
// security. After a change we call router.refresh() so the server component
// re-reads counts and status.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getRegistrationBlockReason } from "@/lib/events";

// Postgres messages can be long and technical; keep anything we show to a
// student short and readable.
function humanise(message) {
  if (!message) return "Registration could not be completed. Please try again.";
  const text = String(message);
  if (text.includes("participant limit")) return "This event has reached its participant limit.";
  if (text.includes("deadline")) return "The registration deadline has passed.";
  if (text.includes("not been published") || text.includes("not open")) {
    return "Registration is not open for this event.";
  }
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (text.length > 160) return "Registration could not be completed. Please try again.";
  return text;
}

export function RegistrationPanel({ event, registration, registeredCount = 0 }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isRegistered = registration?.status === "registered";
  const blockReason = getRegistrationBlockReason(event, registeredCount);

  const run = async (operation) => {
    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();
      await operation(supabase);
      router.refresh();
    } catch (operationError) {
      setError(humanise(operationError?.message));
    } finally {
      setBusy(false);
    }
  };

  const register = () =>
    run(async (supabase) => {
      // A cancelled row may already exist, and UNIQUE(event_id, student_id)
      // means re-registering must update it rather than insert a second row.
      const { data: existing, error: readError } = await supabase
        .from("event_registrations")
        .select("id, status")
        .eq("event_id", event.id)
        .maybeSingle();

      if (readError) throw readError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("event_registrations")
          .update({ status: "registered" })
          .eq("id", existing.id);
        if (updateError) throw updateError;
        return;
      }

      const { error: insertError } = await supabase
        .from("event_registrations")
        .insert({ event_id: event.id, status: "registered" });
      if (insertError) throw insertError;
    });

  const cancel = () =>
    run(async (supabase) => {
      const { error: updateError } = await supabase
        .from("event_registrations")
        .update({ status: "cancelled" })
        .eq("event_id", event.id)
        .eq("status", "registered");
      if (updateError) throw updateError;
    });

  if (isRegistered) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <Icon name="check" className="h-4.5 w-4.5" strokeWidth={2.6} />
          You are registered for this event
        </p>
        <p className="mt-1.5 text-[13px] leading-5 text-emerald-700">
          Your attendance QR codes appear in the sessions timeline below.
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-[13px] font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Cancelling…" : "Cancel registration"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={register}
        disabled={busy || Boolean(blockReason)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        ) : (
          <Icon name="plus" className="h-4.5 w-4.5" strokeWidth={2.4} />
        )}
        {busy ? "Registering…" : "Register"}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-rose-600">
          {error}
        </p>
      ) : blockReason ? (
        <p className="mt-2 text-[13px] font-medium text-slate-500">{blockReason}</p>
      ) : null}
    </div>
  );
}
