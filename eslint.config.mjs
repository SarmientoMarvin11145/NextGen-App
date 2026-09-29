import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch directories, which are not source: `supabase/.temp` is written
    // beside config.toml by the Supabase CLI, and `.function-check` is the
    // throwaway copy `npm run check:functions` makes of supabase/functions
    // while it runs. Keeping them out means `npm run lint` covers source only.
    "supabase/.temp/**",
    ".function-check/**",
  ]),
]);

export default eslintConfig;
