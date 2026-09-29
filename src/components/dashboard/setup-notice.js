import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { BTN_MD, BTN_OUTLINE, PANEL_LG, TITLE_LG } from "@/lib/ui";
import LogoutButton from "./logout-button";

export default function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className={`w-full max-w-lg ${PANEL_LG} p-6 sm:p-9`}>
        <Brand href="/login" />
        <div className="mt-9 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
          <Icon name="info" className="h-6 w-6" strokeWidth={1.9} />
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
          Setup required
        </p>
        <h1 className={`mt-2 ${TITLE_LG}`}>Finish setting up your portal</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Your sign-in worked, but your profile could not be loaded. Apply the included Supabase
          migration, then refresh this page.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Migration files
          </span>
          <code className="mt-2 block break-all font-mono text-[11px] leading-5 text-blue-700">supabase/migrations/202609240001_create_dashboard_schema.sql</code>
          <code className="mt-1.5 block break-all font-mono text-[11px] leading-5 text-blue-700">supabase/migrations/202609250003_create_file_storage.sql</code>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={`${BTN_MD} ${BTN_OUTLINE} flex-1`}>
            Return to login
          </Link>
          <div className="flex flex-1 items-center justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}