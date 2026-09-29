import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { AuthSwitchLink } from "./auth-switch-link";

const benefits = [
  "Keep your academic details in one secure place",
  "Stay informed with the latest campus updates",
  "Access your dashboard on any device",
];

export function AuthShell({ children }) {
  return (
    <main className="min-h-screen bg-[#f7f9fc] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
      <section className="relative hidden overflow-hidden border-r border-blue-100 bg-gradient-to-br from-sky-50 via-white to-blue-100 px-10 py-10 text-slate-900 lg:flex lg:min-h-screen lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative">
          <Brand href="/" showTagline />
        </div>

        <div className="relative max-w-xl pb-10 pt-20">
          <p className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            <span className="h-px w-8 bg-blue-400/70" />
            Your academic home
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 xl:text-6xl">
            Everything you need to move forward.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-600 xl:text-lg">
            A calmer, clearer way to manage your student profile and stay connected to what matters.
          </p>

          <div className="mt-12 grid max-w-md gap-5">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                  <Icon name="check" className="h-4 w-4" strokeWidth={2.2} />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-slate-200 pt-6 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} NextGen Campus</span>
          <span className="flex items-center gap-1.5">
            <Icon name="shield" className="h-3.5 w-3.5" />
            Secure by design
          </span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 sm:py-6 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-3">
          <div className="lg:hidden">
            <Brand href="/login" />
          </div>
          <div className="ml-auto">
            <AuthSwitchLink />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="w-full max-w-[470px]">{children}</div>
        </div>
        <p className="text-center text-xs leading-5 text-slate-500">
          By using NextGen, you agree to our community guidelines and privacy commitments.
        </p>
      </section>
    </main>
  );
}