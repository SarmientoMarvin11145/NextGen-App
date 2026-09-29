"use client";

// Student event browser (spec section 5).
//
// The server page fetches every visible event once, plus the caller's
// registration status and each event's live registration count. Searching and
// filtering happen in memory so browsing never triggers a query per keystroke.
// Registering re-uses RegistrationPanel, which writes under RLS and then
// refreshes the server component.

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EventCard } from "./event-card";
import { RegistrationPanel } from "./registration-panel";
import { getRegistrationBlockReason } from "@/lib/events";
import { FIELD, SCROLL_ROW } from "@/lib/ui";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "registered", label: "Registered" },
  { value: "past", label: "Past" },
];

// "2026-10-15" for today in the viewer's own timezone, so an event that starts
// later today is never treated as past.
function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isPastEvent(event, key) {
  if (event.status === "completed" || event.status === "cancelled") return true;
  const eventKey = String(event.event_date || "").slice(0, 10);
  return Boolean(eventKey && key && eventKey < key);
}

export function EventList({ events = [], counts = {}, registrations = {} }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const key = todayKey();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = events.filter((event) => {
      const count = counts[event.id] ?? 0;
      const registered = registrations[event.id] === "registered";

      if (needle) {
        const haystack = `${event.name} ${event.location_name} ${event.description}`
          .toLowerCase()
          .includes(needle);
        if (!haystack) return false;
      }

      if (filter === "registered") return registered;
      if (filter === "past") return isPastEvent(event, key);
      if (filter === "open") {
        return !isPastEvent(event, key) && !getRegistrationBlockReason(event, count);
      }
      return true;
    });

    return matches.sort((first, second) => {
      const firstPast = isPastEvent(first, key);
      const secondPast = isPastEvent(second, key);
      if (firstPast !== secondPast) return firstPast ? 1 : -1;
      const firstKey = String(first.event_date || "");
      const secondKey = String(second.event_date || "");
      if (firstKey === secondKey) return 0;
      return firstPast ? (firstKey < secondKey ? 1 : -1) : firstKey < secondKey ? -1 : 1;
    });
  }, [events, counts, registrations, query, filter, key]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
          />
          <input
            type="search"
            value={query}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            placeholder="Search events"
            aria-label="Search events"
            className={`${FIELD} pl-11`}
          />
        </div>

        <div className={`${SCROLL_ROW} -mx-1 px-1`} role="tablist" aria-label="Event filters">
          {FILTERS.map((option) => {
            const active = filter === option.value;
            const count =
              option.value === "registered"
                ? events.filter((event) => registrations[event.id] === "registered").length
                : null;

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option.value)}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.label}
                {count ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={events.length === 0 ? "No events published yet" : "No events match this view"}
          description={
            events.length === 0
              ? "Check back soon. Events appear here as soon as an administrator publishes them."
              : "Try a different search term or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              registeredCount={counts[event.id] ?? 0}
              isRegistered={registrations[event.id] === "registered"}
              action={
                <RegistrationPanel
                  event={event}
                  registration={
                    registrations[event.id] ? { status: registrations[event.id] } : null
                  }
                  registeredCount={counts[event.id] ?? 0}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
