// Single source of truth for the visual language: shape, depth, type, and
// colour. Components import these strings instead of repeating long utility
// lists, so every surface in the app stays identical and easy to tune.
//
// Rules of the system:
//   - Panels (sections, cards) use rounded-2xl with a hairline border and a
//     very soft shadow. rounded-3xl is reserved for hero surfaces.
//   - Controls (inputs, buttons, tabs) use rounded-xl and are at least 44px
//     tall so they stay comfortable on a phone.
//   - Micro labels are 11px, bold, uppercase, and slate-500 (never lighter,
//     so contrast stays readable).

export const HAIRLINE = "border-slate-200/70";

const SOFT_SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const RAISED_SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.35)]";
// Written as one literal so Tailwind's scanner sees the full hover: class
// (interpolating `hover:${RAISED_SHADOW}` produces a string the scanner never
// sees, so the hover shadow silently never ships).
const RAISED_HOVER =
  "hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_34px_-20px_rgba(15,23,42,0.38)]";

export const PANEL = `rounded-2xl border ${HAIRLINE} bg-white ${SOFT_SHADOW}`;
export const PANEL_PADDED = `${PANEL} p-4 sm:p-5`;
export const PANEL_LG = `rounded-3xl border ${HAIRLINE} bg-white ${SOFT_SHADOW}`;
export const PANEL_INTERACTIVE = `${PANEL} transition hover:border-blue-200/80 ${RAISED_HOVER}`;

export const MICRO = "text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500";
export const MICRO_TIGHT = "text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500";
export const TITLE = "text-[15px] font-semibold tracking-[-0.01em] text-slate-900";
export const TITLE_LG = "text-lg font-semibold tracking-[-0.02em] text-slate-900";
export const DISPLAY = "text-[1.6rem] font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-[2rem]";
export const VALUE = "text-[1.35rem] font-semibold tracking-[-0.03em] tabular-nums text-slate-900 sm:text-2xl";
export const META = "text-xs font-medium text-slate-500";
export const META_TIGHT = "text-[11px] font-medium text-slate-500";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1";

const FIELD_BASE =
  "w-full rounded-xl border border-slate-200 bg-white text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:text-sm";

// 48px tall with 16px text: comfortable to tap, and it stops iOS from zooming
// in when a field receives focus.
export const FIELD = `${FIELD_BASE} h-12 px-4`;
export const FIELD_ICON = `${FIELD_BASE} h-12 pl-11 pr-4`;
// Same as FIELD_ICON but with room for a trailing action (e.g. show/hide password).
export const FIELD_ICON_ACTION = `${FIELD_BASE} h-12 pl-11 pr-12`;
export const FIELD_TEXTAREA = `${FIELD_BASE} resize-none px-4 py-3 leading-6`;
// Selects hide the native arrow, so callers must render their own chevron.
export const FIELD_SELECT = `${FIELD_BASE} h-12 appearance-none pl-11 pr-10`;

export const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_PRIMARY = `${BTN} bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] hover:bg-blue-700`;
export const BTN_OUTLINE = `${BTN} border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800`;
export const BTN_QUIET = `${BTN} text-slate-600 hover:bg-slate-100/80 hover:text-slate-900`;
export const BTN_DANGER = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;
export const BTN_MD = "h-11 px-4";
export const BTN_SM = "h-10 px-3 text-[13px]";
export const BTN_ICON = "h-11 w-11 shrink-0";

// One accent per meaning: blue is the brand/student accent, indigo marks
// administrator-only surfaces. Each tone exposes the same four slots so any
// component can be recoloured by changing a single prop.
export const TONES = {
  blue: {
    soft: "bg-blue-50 text-blue-700",
    solid: "bg-blue-600 text-white",
    ring: "ring-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
    border: "border-blue-200",
  },
  indigo: {
    soft: "bg-indigo-50 text-indigo-700",
    solid: "bg-indigo-600 text-white",
    ring: "ring-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
  },
  sky: {
    soft: "bg-sky-50 text-sky-700",
    solid: "bg-sky-600 text-white",
    ring: "ring-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
    border: "border-sky-200",
  },
  violet: {
    soft: "bg-violet-50 text-violet-700",
    solid: "bg-violet-600 text-white",
    ring: "ring-violet-100",
    text: "text-violet-700",
    dot: "bg-violet-500",
    border: "border-violet-200",
  },
  amber: {
    soft: "bg-amber-50 text-amber-700",
    solid: "bg-amber-500 text-white",
    ring: "ring-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  rose: {
    soft: "bg-rose-50 text-rose-600",
    solid: "bg-rose-600 text-white",
    ring: "ring-rose-100",
    text: "text-rose-600",
    dot: "bg-rose-500",
    border: "border-rose-200",
  },
  slate: {
    soft: "bg-slate-100 text-slate-600",
    solid: "bg-slate-800 text-white",
    ring: "ring-slate-200",
    text: "text-slate-600",
    dot: "bg-slate-400",
    border: "border-slate-200",
  },
};

export function tone(name) {
  return TONES[name] || TONES.blue;
}

// Hidden scrollbars for the horizontally scrollable chip rows on phones.
export const SCROLL_ROW =
  "flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
