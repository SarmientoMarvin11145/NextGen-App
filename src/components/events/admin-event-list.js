"use client";

// Admin: every event in one table with the numbers that matter (spec section 40).
//
// Filtering happens in memory: the admin page already fetched each event once,
// so typing in the search box never touches the network.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/dashboard/empty-state";
import { eventStatusLabel, eventStatusTone, formatEventDate } from "@/lib/events";
import { BTN_MD, BTN_OUTLINE, FIELD, MICRO, PANEL, SCROLL_ROW, tone as toneOf } from "@/lib/ui";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function AdminEventList({ events = [], registrations = {}, sessions = {}, scanners = {} }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (status !== "all" && event.status !== status) return false;
      if (!needle) return true;
      return `${event.name} ${event.location_name}`.toLowerCase().includes(needle);
    });
  }, [events, query, status]);

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

        <div className={`${SCROLL_ROW} -mx-1 px-1`} role="tablist" aria-label="Status filters">
          {STATUS_FILTERS.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(option.value)}
                className={`inline-flex h-10 shrink-0 items-center rounded-xl px-3.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={events.length === 0 ? "No events yet" : "No events match this view"}
          description={
            events.length === 0
              ? "Create your first event, then add attendance sessions so students can check in."
              : "Try a different search term or status filter."
          }
        />
      ) : (
        <div className={`${PANEL} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th>Event</Th>
                  <Th>Status</Th>
                  <Th>Registrations</Th>
                  <Th>Sessions</Th>
                  <Th>Scanners</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((event) => (
                  <AdminEventRow
                    key={event.id}
                    event={event}
                    registered={registrations[event.id] ?? 0}
                    sessionCount={sessions[event.id] ?? 0}
                    scannerCount={scanners[event.id] ?? 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className={`${MICRO} border-t border-slate-100 px-4 py-3`}>
            {visible.length} of {events.length} event{events.length === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}


function AdminEventRow({ event, registered, sessionCount, scannerCount }) {
  const accent = toneOf(eventStatusTone(event.status));
  const capacity = event.max_participants;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <span className="block text-[13.5px] font-semibold text-slate-900">{event.name}</span>
        <span className="mt-0.5 block text-[11.5px] font-medium text-slate-500">
          {formatEventDate(event.event_date)} · {event.location_name}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${accent.soft}`}
        >
          {eventStatusLabel(event.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-slate-700">
        {capacity ? `${registered} / ${capacity}` : registered}
      </td>
      <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-slate-700">
        {sessionCount === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <Icon name="info" className="h-3.5 w-3.5" strokeWidth={2} />
            None
          </span>
        ) : (
          sessionCount
        )}
      </td>
      <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-slate-700">
        {scannerCount}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/events/${event.id}`} className={`${BTN_OUTLINE} ${BTN_MD} text-[13px]`}>
            <Icon name="edit" className="h-4 w-4" strokeWidth={2} />
            Manage
          </Link>
          <Link href={`/events/${event.id}`} className={`${BTN_OUTLINE} ${BTN_MD} text-[13px]`}>
            View
          </Link>
        </div>
      </td>
    </tr>
  );
}

function Th({ children }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500"
    >
      {children}
    </th>
  );
}
