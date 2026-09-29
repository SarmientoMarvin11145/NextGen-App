"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import { BTN_MD, BTN_PRIMARY, FIELD, FIELD_TEXTAREA } from "@/lib/ui";

export default function AnnouncementComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (title.trim().length < 3 || body.trim().length < 5) {
      setMessage("Add a title and a little more detail before publishing.");
      return;
    }

    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("announcements").insert({
        title: title.trim(),
        body: body.trim(),
        published: true,
      });

      if (error) throw error;

      setTitle("");
      setBody("");
      router.refresh();
    } catch (error) {
      setMessage(error?.message || "The update could not be published.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="announcement-title" className="text-sm font-semibold text-slate-700">
            Update title
          </label>
          <span className="text-[11px] font-medium tabular-nums text-slate-500">
            {title.length}/120
          </span>
        </div>
        <input
          id="announcement-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Registration reminder"
          maxLength={120}
          className={FIELD}
          required
        />
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="announcement-body" className="text-sm font-semibold text-slate-700">
            What should students know?
          </label>
          <span className="text-[11px] font-medium tabular-nums text-slate-500">
            {body.length}/2000
          </span>
        </div>
        <textarea
          id="announcement-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a short, helpful update..."
          rows={4}
          maxLength={2000}
          className={FIELD_TEXTAREA}
          required
        />
      </div>
      {message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold leading-5 text-rose-700"
        >
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${BTN_PRIMARY} ${BTN_MD} w-full`}>
        {pending ? (
          <Icon name="loader" className="h-4 w-4 animate-spin" />
        ) : (
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
        )}
        {pending ? "Publishing..." : "Publish update"}
      </button>
    </form>
  );
}