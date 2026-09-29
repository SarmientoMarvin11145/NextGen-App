// Supabase's CLI resolves a function's entry point as
// `supabase/functions/<name>/index.ts` and never looks for `index.js`, so this
// file exists only to satisfy that lookup. It adds no behaviour: every request
// handler, helper and route lives in `index.js` beside it, which the import
// below loads (that module is what calls `Deno.serve`).
//
// Keeping the implementation is deliberate - the repository has no TypeScript
// toolchain for these files, and `npm run check:functions` runs them as plain
// JavaScript.
import "./index.js";
