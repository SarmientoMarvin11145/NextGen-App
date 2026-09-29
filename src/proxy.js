import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Next.js 16 renamed Middleware to Proxy. This file keeps the Supabase session
// fresh: the refreshed tokens are written back to the browser and forwarded to
// the current request so server components always read the newest session.
export async function proxy(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching auth.getUser() is what triggers the token refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static assets in /public.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)",
  ],
};
