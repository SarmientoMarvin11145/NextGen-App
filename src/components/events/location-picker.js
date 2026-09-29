"use client";

// Venue picker for the admin event and session forms (spec sections 3, 40).
//
// This is a deliberately small slippy map built from OpenStreetMap raster
// tiles rather than a mapping library: the app ships no map dependency, so the
// picker is a handful of Web Mercator helpers plus <img> tiles. It draws the
// tiles that cover the visible box, keeps the pin at the centre of that box,
// and turns a click or a drag into latitude/longitude.
//
// The pin is owned by the caller (the form's latitude/longitude fields); zoom
// stays local because it is a view preference rather than data.

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE = 40075016.686; // metres around the equator
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const TILE_URL = "https://tile.openstreetmap.org";

// Campus default when the form has no coordinates yet (Metro Manila).
const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842, zoom: 12 };

// Every helper below works in "world pixels": the map is TILE_SIZE * 2^zoom
// wide and tall, x grows east and y grows south from the north-west corner at
// 180 degrees W / 85.05112878 degrees N (EPSG:3857).
function worldSize(zoom) {
  return TILE_SIZE * 2 ** zoom;
}

// The form's inputs hold strings, and "" has to mean "no point yet" instead of
// the coordinate 0.
function toFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Web Mercator forward projection.
function project(latitude, longitude, zoom) {
  const size = worldSize(zoom);
  const clamped = Math.max(Math.min(Number(latitude), 85.05112878), -85.05112878);
  const radians = (clamped * Math.PI) / 180;
  return {
    x: ((Number(longitude) + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * size,
  };
}

// Inverse projection, used to turn a click or a drag into coordinates.
function unproject(x, y, zoom) {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    longitude: (x / size) * 360 - 180,
  };
}

// A metre is worth fewer pixels the further you get from the equator, so the
// radius ring has to be scaled by the cosine of the latitude.
function radiusToPixels(metres, latitude, zoom) {
  const resolution =
    (EARTH_CIRCUMFERENCE * Math.cos((Number(latitude) * Math.PI) / 180)) /
    (TILE_SIZE * 2 ** zoom);
  const pixels = (Number(metres) || 0) / resolution;
  return Math.max(6, Math.min(pixels, 4000));
}

function round6(value) {
  return Number(value.toFixed(6));
}

export function LocationPicker({ latitude, longitude, radius = 20, onChange, height = 320 }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  const pointLatitude = toFiniteNumber(latitude);
  const pointLongitude = toFiniteNumber(longitude);
  const hasPoint = pointLatitude !== null && pointLongitude !== null;

  // The pin is the form's coordinate rather than local state: typing in the
  // numeric inputs and clicking the map both end up in onChange, so the props
  // stay the single source of truth and no effect has to copy them into state.
  // Only the zoom is stateful, because it is a view preference, not data.
  const centerLatitude = hasPoint ? pointLatitude : DEFAULT_CENTER.latitude;
  const centerLongitude = hasPoint ? pointLongitude : DEFAULT_CENTER.longitude;

  const [zoom, setZoom] = useState(hasPoint ? 17 : DEFAULT_CENTER.zoom);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  // Tiles are placed from the measured box, so it is measured after paint and
  // again on resize.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const commit = useCallback(
    (point) => {
      onChange?.({ latitude: round6(point.latitude), longitude: round6(point.longitude) });
    },
    [onChange],
  );

  const handlePointerDown = (event) => {
    // Zoom buttons and the attribution link live inside the box, so a press
    // that lands on one of them must not start a map drag.
    if (event.target.closest?.("button, a")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      // Captured once, so the whole gesture is measured against the same view
      // even if the form re-renders while the finger is down.
      center: project(centerLatitude, centerLongitude, zoom),
    };
    setDrag({ x: 0, y: 0 });
  };

  const handlePointerMove = (event) => {
    const start = dragRef.current;
    if (!start) return;
    setDrag({ x: event.clientX - start.pointerX, y: event.clientY - start.pointerY });
  };

  const handlePointerEnd = (event) => {
    const start = dragRef.current;
    if (!start) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const offsetX = event.clientX - start.pointerX;
    const offsetY = event.clientY - start.pointerY;
    setDrag({ x: 0, y: 0 });

    // A press that did not move is a click: the box centre is the view centre,
    // so the distance from the centre is the offset in world pixels.
    if (Math.abs(offsetX) < 3 && Math.abs(offsetY) < 3) {
      const rect = event.currentTarget.getBoundingClientRect();
      commit(
        unproject(
          start.center.x + (event.clientX - rect.left - rect.width / 2),
          start.center.y + (event.clientY - rect.top - rect.height / 2),
          zoom,
        ),
      );
      return;
    }

    // Panning moves the tiles, not the pin, so the new centre is the old centre
    // shifted by the drag.
    commit(unproject(start.center.x - offsetX, start.center.y - offsetY, zoom));
  };

  const changeZoom = (delta) =>
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)));

  // Tiles covering the visible box, and where each one sits inside it.
  const center = project(centerLatitude, centerLongitude, zoom);
  const topLeft = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  const tiles = [];
  const tileCount = 2 ** zoom;

  if (size.width > 0 && size.height > 0) {
    const firstX = Math.floor(topLeft.x / TILE_SIZE);
    const lastX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
    const firstY = Math.floor(topLeft.y / TILE_SIZE);
    const lastY = Math.floor((topLeft.y + size.height) / TILE_SIZE);

    for (let tileY = firstY; tileY <= lastY; tileY += 1) {
      // Above the north pole and below the south pole there are no tiles.
      if (tileY < 0 || tileY >= tileCount) continue;
      for (let tileX = firstX; tileX <= lastX; tileX += 1) {
        // Longitude wraps around the date line.
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${zoom}/${tileX}/${tileY}`,
          url: `${TILE_URL}/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - topLeft.x,
          top: tileY * TILE_SIZE - topLeft.y,
        });
      }
    }
  }

  const ringRadius = radiusToPixels(radius, centerLatitude, zoom);

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 cursor-crosshair active:cursor-grabbing"
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      role="application"
      aria-label="Map for choosing the venue location. Click to place the pin, or drag to move the map."
    >
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element -- map tiles come from the OpenStreetMap raster service; next/image would only add a proxy hop per tile.
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="lazy"
            className="pointer-events-none absolute max-w-none"
            style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
      </div>

      {/* The allowed-radius ring and the pin both sit at the centre of the box,
          which is the point the form stores. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-dashed border-blue-500/70 bg-blue-500/10"
        style={{
          width: ringRadius * 2,
          height: ringRadius * 2,
          transform: "translate(-50%, -50%)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 rounded-full border-[3px] border-white bg-blue-600 shadow-[0_2px_10px_rgba(15,23,42,0.45)]" style={{ transform: "translate(-50%, -50%)" }} />

      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm">
        <button
          type="button"
          onClick={() => changeZoom(1)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          className="h-9 w-9 text-lg font-semibold leading-none text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
        >
          +
        </button>
        <span className="h-px bg-slate-200" />
        <button
          type="button"
          onClick={() => changeZoom(-1)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          className="h-9 w-9 text-lg font-semibold leading-none text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
        >
          −
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
        {hasPoint
          ? `${pointLatitude.toFixed(6)}, ${pointLongitude.toFixed(6)}`
          : "Click the map to drop the pin"}
      </p>

      <p className="absolute bottom-1 right-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-600">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        contributors
      </p>
    </div>
  );
}

