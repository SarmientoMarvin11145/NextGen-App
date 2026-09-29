"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthErrorMessage } from "@/lib/auth-messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import { BTN, BTN_MD, FIELD, MICRO, PANEL, tone as toneOf } from "@/lib/ui";

const STATUS_CONTENT = {
  sent: {
    tone: "blue",
    icon: "mailCheck",
    eyebrow: "One last step",
    title: "Verify your email first",
    description: "You must confirm your email address before you can sign in.",
  },
  expired: {
    tone: "amber",
    icon: "clock",
    eyebrow: "Link expired",
    title: "That verification link has expired",
    description: "Verification links are short lived. Request a new one below.",
  },
  invalid: {
    tone: "rose",
    icon: "info",
    eyebrow: "Link not valid",
    title: "That verification link is not valid",
    description:
      "The link may have been used already or was copied incorrectly. Request a new one below.",
  },
};

const COOLDOWN_SECONDS = 45;

export default function VerifyEmailPanel({ email = "", status = "sent" }) {
  const router = useRouter();
  const content = STATUS_CONTENT[status] || STATUS_CONTENT.sent;
  const accent = toneOf(content.tone);
  const [currentEmail, setCurrentEmail] = useState(email);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (pending || cooldown > 0) return;

    const target = currentEmail.trim();
    if (!target) {
      setMessage("Enter the email address you registered with.");
      setSuccess("");
      return;
    }

    setPending(true);
    setMessage("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) throw error;

      setSuccess(`A new confirmation link is on its way to ${target}.`);
      setCooldown(COOLDOWN_SECONDS);
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-fade">
      <div className="mb-6">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ring-inset ${accent.soft} ${accent.ring}`}
        >
          <Icon name={content.icon} className="h-6 w-6" strokeWidth={1.9} />
        </div>
        <p className={`mt-5 ${MICRO} ${accent.text}`}>{content.eyebrow}</p>
        <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-[2rem]">
          {content.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{content.description}</p>
      </div>

      <div className={`${PANEL} p-4 sm:p-5`}>
        <p className={MICRO}>Confirmation email</p>
        {email ? (
          <p className="mt-2 flex items-start gap-2 break-all text-sm font-semibold text-slate-800">
            <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            {email}
          </p>
        ) : (
          <div className="mt-3">
            <label htmlFor="verify-email" className="sr-only">
              Email address
            </label>
            <input
              id="verify-email"
              type="email"
              name="email"
              value={currentEmail}
              onChange={(event) => {
                setCurrentEmail(event.target.value);
                setMessage("");
                setSuccess("");
              }}
              placeholder="you@example.com"
              autoComplete="email"
              className={FIELD}
            />
          </div>
        )}
      </div>

      <ol className="mt-6 space-y-2.5">
        {[
          ["Open the email we sent you", "Look for a message from NextGen Campus in your inbox."],
          ["Tap the confirmation link", "It opens a secure page that verifies your account."],
          ["Sign in with your password", "You are redirected to the login screen once verified."],
        ].map(([title, description], index) => (
          <li key={title} className="flex gap-3 rounded-xl bg-slate-50/70 px-3.5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            </div>
          </li>
        ))}
      </ol>

      {message ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
        >
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-800"
        >
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className={`${BTN} ${BTN_MD} w-full bg-blue-600 text-white shadow-[0_1px_2px_rgba(37,99,235,0.3)] hover:bg-blue-700`}
        >
          <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.2} />
          I verified my email — go to login
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={pending || cooldown > 0}
          className={`${BTN} ${BTN_MD} w-full border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800`}
        >
          <Icon
            name={pending ? "loader" : "refresh"}
            className={`h-4 w-4 ${pending ? "animate-spin" : ""}`}
          />
          {pending
            ? "Sending..."
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend confirmation email"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs leading-5 text-slate-500">
        Used the wrong email address?{" "}
        <Link href="/register" className="font-bold text-blue-700 hover:text-blue-800">
          Create a new account
        </Link>
      </p>
    </div>
  );
}

