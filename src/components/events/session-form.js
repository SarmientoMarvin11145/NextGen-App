"use client";

// Create or edit one attendance session (spec section 41).
//
// `starts_at` / `ends_at` are the authoritative window, so they are derived
// from the date and times the admin picks. A window whose end is not after its
// start is rolled into the next day, so a 10:00 PM - 12:00 AM session works.

import { useState } from "react";
import { FIELD } from "@/lib/ui";

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Builds the two instants from wall-clock inputs interpreted in the admin's
// timezone (the campus timezone, which is also where students read the clock).
function buildWindow(date, startTime, endTime) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [startHour, startMinute] = String(startTime).split(":").map(Number);
  const [endHour, endMinute] = String(endTime).split(":").map(Number);

  const startsAt = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  let endsAt = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startsAt, endsAt };
}

export function SessionForm({ event, session = null, onSaved, onCancel, submitting, error }) {
  const isEditing = Boolean(session?.id);

  const [form, setForm] = useState(() => ({
    name: session?.name ?? "",
    session_date: session?.session_date ?? event?.event_date ?? todayInput(),
    start_time: session?.start_time ? String(session.start_time).slice(0, 5) : "08:00",
    end_time: session?.end_time ? String(session.end_time).slice(0, 5) : "10:00",
    latitude: session?.latitude ?? event?.latitude ?? "",
    longitude: session?.longitude ?? event?.longitude ?? "",
    allowed_radius: session?.allowed_radius ?? event?.allowed_radius ?? 20,
  }));
  const [localError, setLocalError] = useState(null);

  const update = (field) => (event_) =>
    setForm((current) => ({ ...current, [field]: event_.target.value }));

  const handleSubmit = async (event_) => {
    event_.preventDefault();
    setLocalError(null);

    if (form.name.trim().length < 2) {
      setLocalError("Give the session a name.");
      return;
    }
    if (!form.session_date || !form.start_time || !form.end_time) {
      setLocalError("Choose a date, start time, and end time.");
      return;
    }
    if (form.start_time === form.end_time) {
      setLocalError("The end time must be different from the start time.");
      return;
    }

    const radius = Number(form.allowed_radius);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 10000) {
      setLocalError("Allowed radius must be between 1 and 10000 metres.");
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setLocalError("Latitude must be between -90 and 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setLocalError("Longitude must be between -180 and 180.");
      return;
    }

    const { startsAt, endsAt } = buildWindow(form.session_date, form.start_time, form.end_time);

    const payload = {
      name: form.name.trim(),
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      latitude,
      longitude,
      allowed_radius: radius,
      status: session?.status ?? "scheduled",
      ...(isEditing ? {} : { event_id: event.id }),
    };

    await onSaved?.(payload, { isEditing, id: session?.id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {localError || error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700"
        >
          {localError || error}
        </div>
      ) : null}

      <Field label="Session name" htmlFor="session-name">
        <input
          id="session-name"
          type="text"
          value={form.name}
          onChange={update("name")}
          placeholder="Day 1 - Morning Attendance"
          className={FIELD}
          required
        />
      </Field>

      <Field label="Date" htmlFor="session-date">
        <input
          id="session-date"
          type="date"
          value={form.session_date}
          onChange={update("session_date")}
          className={FIELD}
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start time" htmlFor="session-start">
          <input
            id="session-start"
            type="time"
            value={form.start_time}
            onChange={update("start_time")}
            className={FIELD}
            required
          />
        </Field>
        <Field label="End time" htmlFor="session-end">
          <input
            id="session-end"
            type="time"
            value={form.end_time}
            onChange={update("end_time")}
            className={FIELD}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Latitude" htmlFor="session-lat">
          <input
            id="session-lat"
            type="number"
            step="any"
            value={form.latitude}
            onChange={update("latitude")}
            className={FIELD}
            required
          />
        </Field>
        <Field label="Longitude" htmlFor="session-lng">
          <input
            id="session-lng"
            type="number"
            step="any"
            value={form.longitude}
            onChange={update("longitude")}
            className={FIELD}
            required
          />
        </Field>
        <Field label="Radius (m)" htmlFor="session-radius">
          <input
            id="session-radius"
            type="number"
            min="1"
            max="10000"
            value={form.allowed_radius}
            onChange={update("allowed_radius")}
            className={FIELD}
            required
          />
        </Field>
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] leading-5 text-slate-500">
        Location defaults to{" "}
        <span className="font-semibold text-slate-700">{event?.location_name}</span>. Change the
        coordinates only when a session happens somewhere else.
      </p>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100/80 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : isEditing ? "Save session" : "Add session"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
