"use client";

// Create / edit an event (spec sections 3, 40).
//
// The map is loaded with next/dynamic and ssr:false so the OpenStreetMap tiles
// and the pointer handlers only ever run in the browser. Every write goes
// through RLS, which only lets admins insert or update events; this form
// validates first so the user gets instant feedback instead of a database
// error.

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { BTN_MD, BTN_OUTLINE, BTN_PRIMARY, FIELD, FIELD_TEXTAREA, FIELD_SELECT, MICRO, PANEL } from "@/lib/ui";

const LocationPicker = dynamic(
  () => import("./location-picker").then((module) => module.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

const EVENT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft (hidden from students)" },
  { value: "published", label: "Published (visible to students)" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

function toTimeInput(value) {
  return value ? String(value).slice(0, 5) : "";
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EventForm({ event = null }) {
  const router = useRouter();
  const isEditing = Boolean(event?.id);

  const [form, setForm] = useState(() => ({
    name: event?.name ?? "",
    description: event?.description ?? "",
    image_url: event?.image_url ?? "",
    event_date: toDateInput(event?.event_date),
    start_time: toTimeInput(event?.start_time),
    end_time: toTimeInput(event?.end_time),
    location_name: event?.location_name ?? "",
    latitude: event?.latitude ?? "",
    longitude: event?.longitude ?? "",
    allowed_radius: event?.allowed_radius ?? 20,
    registration_deadline: toDateTimeLocal(event?.registration_deadline),
    max_participants: event?.max_participants ?? "",
    status: event?.status ?? "draft",
  }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event_) =>
    setForm((current) => ({ ...current, [field]: event_.target.value }));

  const setCoordinates = ({ latitude, longitude }) =>
    setForm((current) => ({ ...current, latitude, longitude }));

  const validate = () => {
    const found = [];
    if (form.name.trim().length < 3) found.push("Event name must be at least 3 characters.");
    if (!form.event_date) found.push("Choose an event date.");
    if (!form.start_time || !form.end_time) found.push("Choose a start and end time.");
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      found.push("End time must be after the start time.");
    }
    if (form.location_name.trim().length < 2) found.push("Enter a location name.");

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      found.push("Latitude must be between -90 and 90.");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      found.push("Longitude must be between -180 and 180.");
    }

    const radius = Number(form.allowed_radius);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 10000) {
      found.push("Allowed radius must be between 1 and 10000 metres.");
    }
    if (form.max_participants !== "" && Number(form.max_participants) <= 0) {
      found.push("Maximum participants must be greater than zero.");
    }
    if (
      form.registration_deadline &&
      form.event_date &&
      form.end_time &&
      new Date(form.registration_deadline) >
        new Date(`${form.event_date}T${form.end_time}`)
    ) {
      found.push("Registration deadline cannot be after the event ends.");
    }
    return found;
  };

  const handleSubmit = async (event_) => {
    event_.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    setSaving(true);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Check your environment variables.");
      }
      const supabase = getSupabaseBrowserClient();
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location_name: form.location_name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        allowed_radius: Number(form.allowed_radius),
        registration_deadline: form.registration_deadline
          ? new Date(form.registration_deadline).toISOString()
          : null,
        max_participants: toNumberOrNull(form.max_participants),
        status: form.status,
      };

      const { error: writeError } = isEditing
        ? await supabase.from("events").update(payload).eq("id", event.id)
        : await supabase.from("events").insert(payload);

      if (writeError) throw writeError;

      router.push("/admin/events");
      router.refresh();
    } catch (submitError) {
      const message = submitError?.message || "The event could not be saved.";
      setErrors([message.length > 160 ? "The event could not be saved. Please try again." : message]);
    } finally {
      setSaving(false);
    }
  };

  const hasCoordinates =
    Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) &&
    form.latitude !== "" && form.longitude !== "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errors.length > 0 ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">Check the following</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-rose-700">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-5">
          <Field label="Event name" htmlFor="event-name">
            <input
              id="event-name"
              type="text"
              value={form.name}
              onChange={update("name")}
              placeholder="University Leadership Conference"
              className={FIELD}
              required
            />
          </Field>

          <Field label="Description" htmlFor="event-description" hint="Shown on the event card and detail page.">
            <textarea
              id="event-description"
              value={form.description}
              onChange={update("description")}
              rows={4}
              placeholder="What is this event about?"
              className={FIELD_TEXTAREA}
            />
          </Field>

          <Field
            label="Banner image URL"
            htmlFor="event-image"
            hint="Paste a direct link to an image. Leave blank to use the default banner."
          >
            <input
              id="event-image"
              type="url"
              value={form.image_url}
              onChange={update("image_url")}
              placeholder="https://…/banner.jpg"
              className={FIELD}
            />
          </Field>

          {form.image_url ? (
            <div className="h-36 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin supplied URL */}
              <img
                src={form.image_url}
                alt="Banner preview"
                className="h-full w-full object-cover"
                onError={(event_) => {
                  event_.currentTarget.style.display = "none";
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Event date" htmlFor="event-date">
              <input
                id="event-date"
                type="date"
                value={form.event_date}
                onChange={update("event_date")}
                className={FIELD}
                required
              />
            </Field>
            <Field label="Start time" htmlFor="event-start">
              <input
                id="event-start"
                type="time"
                value={form.start_time}
                onChange={update("start_time")}
                className={FIELD}
                required
              />
            </Field>
            <Field label="End time" htmlFor="event-end">
              <input
                id="event-end"
                type="time"
                value={form.end_time}
                onChange={update("end_time")}
                className={FIELD}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registration deadline" htmlFor="event-deadline" hint="Optional.">
              <input
                id="event-deadline"
                type="datetime-local"
                value={form.registration_deadline}
                onChange={update("registration_deadline")}
                className={FIELD}
              />
            </Field>
            <Field label="Maximum participants" htmlFor="event-capacity" hint="Optional.">
              <input
                id="event-capacity"
                type="number"
                min="1"
                value={form.max_participants}
                onChange={update("max_participants")}
                placeholder="No limit"
                className={FIELD}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="event-status" hint="Save as a draft first, then publish when ready.">
            <select
              id="event-status"
              value={form.status}
              onChange={update("status")}
              className={FIELD_SELECT}
            >
              {EVENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-5">
          <div className={`${PANEL} p-4`}>
            <p className={MICRO}>Venue location</p>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
              Click the map or drag the pin to set the venue. The circle shows the allowed
              attendance radius.
            </p>

            <div className="mt-3">
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                radius={form.allowed_radius}
                onChange={setCoordinates}
              />
            </div>

            {!hasCoordinates ? (
              <p className="mt-2 text-[12.5px] font-medium text-amber-600">
                Pick a point on the map to set the coordinates.
              </p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Latitude" htmlFor="event-lat">
                <input
                  id="event-lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={update("latitude")}
                  className={FIELD}
                  required
                />
              </Field>
              <Field label="Longitude" htmlFor="event-lng">
                <input
                  id="event-lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={update("longitude")}
                  className={FIELD}
                  required
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field
                label="Allowed attendance radius (metres)"
                htmlFor="event-radius"
                hint="Students must be within this distance of the session point."
              >
                <input
                  id="event-radius"
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
          </div>

          <Field label="Location name" htmlFor="event-location">
            <input
              id="event-location"
              type="text"
              value={form.location_name}
              onChange={update("location_name")}
              placeholder="University Gymnasium"
              className={FIELD}
              required
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Link
          href="/admin/events"
          className={`${BTN_OUTLINE} ${BTN_MD} no-underline px-5`}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className={`${BTN_PRIMARY} ${BTN_MD} px-6`}
        >
          {saving ? "Saving…" : isEditing ? "Save changes" : "Create event"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-[12px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}


