"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLOCKS, COURSES, YEARS } from "@/lib/constants";
import { getAuthErrorMessage } from "@/lib/auth-messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPostAuthPath } from "@/lib/supabase/navigation";
import { Icon } from "@/components/ui/icon";
import { BTN_OUTLINE, BTN_PRIMARY, FIELD_ICON, FIELD_ICON_ACTION, FIELD_SELECT, MICRO } from "@/lib/ui";

const initialValues = {
  name: "",
  email: "",
  course: "",
  year: "",
  block: "",
  password: "",
  terms: false,
};

function InputField({
  label,
  name,
  value,
  onChange,
  icon,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  minLength,
  endAdornment,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <Icon
          name={icon}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
          strokeWidth={1.9}
        />
        <input
          className={endAdornment ? FIELD_ICON_ACTION : FIELD_ICON}
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        {endAdornment}
      </span>
    </label>
  );
}

// Selects reuse the icon-left field styling; the chevron is explicit because
// appearance-none hides the native arrow.
function SelectField({ label, name, value, onChange, icon, placeholder, options, className = "block" }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <Icon
          name={icon}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
          strokeWidth={1.9}
        />
        <select name={name} value={value} onChange={onChange} className={FIELD_SELECT} required>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
          strokeWidth={1.9}
        />
      </span>
    </label>
  );
}

export default function AuthForm({ mode = "login", verified = false }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [values, setValues] = useState(initialValues);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(verified ? "Your email is verified. You can now sign in." : "");

  function updateValue(event) {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setMessage("");
    setSuccess("");
  }

  function validate() {
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email)) {
      return "Please enter a valid email address.";
    }
    if (isRegister && values.name.trim().length < 2) {
      return "Please enter your full name.";
    }
    if (isRegister && !values.course) return "Please select your course.";
    if (isRegister && !values.year) return "Please select your year.";
    if (isRegister && !values.block) return "Please select your block.";
    if (values.password.length < 8) {
      return "Your password must be at least 8 characters.";
    }
    if (isRegister && !values.terms) {
      return "Please confirm the terms before creating your account.";
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationMessage = validate();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setPending(true);
    setMessage("");
    setSuccess("");

    try {
      const supabase = getSupabaseBrowserClient();

      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            // The confirmation link opens /auth/confirm, which verifies the
            // account and then hands the person over to the login screen.
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
            data: {
              full_name: values.name.trim(),
              course: values.course,
              year: values.year,
              block: values.block,
              terms_accepted: values.terms,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          router.replace(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
          router.refresh();
          return;
        }

        const path = await getPostAuthPath(supabase);
        router.replace(path);
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) throw error;

      const path = await getPostAuthPath(supabase);
      router.replace(path);
      router.refresh();
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const passwordAdornment = (
    <button
      type="button"
      onClick={() => setShowPassword((current) => !current)}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      <Icon name={showPassword ? "eyeOff" : "eye"} className="h-4.5 w-4.5" strokeWidth={1.9} />
    </button>
  );

  return (
    <div>
      <div className="mb-8">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
          <Icon name={isRegister ? "userCheck" : "lock"} className="h-6 w-6" strokeWidth={1.9} />
        </div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
          {isRegister ? "Start your journey" : "Welcome back"}
        </p>
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
          {isRegister ? "Create your account" : "Sign in to NextGen"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {isRegister
            ? "Tell us a little about yourself to set up your student profile."
            : "Use your registered email and password to access your dashboard."}
        </p>
      </div>

      {message ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      {success ? (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-800">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>{success}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {isRegister ? (
          <InputField
            label="Full name"
            name="name"
            value={values.name}
            onChange={updateValue}
            icon="user"
            placeholder="Juan Dela Cruz"
            autoComplete="name"
            minLength={2}
          />
        ) : null}

        <InputField
          label="Email address"
          name="email"
          type="email"
          value={values.email}
          onChange={updateValue}
          icon="mail"
          placeholder="you@example.com"
          autoComplete="email"
        />

        {isRegister ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Course"
              name="course"
              value={values.course}
              onChange={updateValue}
              icon="book"
              placeholder="Select course"
              options={COURSES.map((course) => ({ value: course, label: course }))}
            />
            <SelectField
              label="Year"
              name="year"
              value={values.year}
              onChange={updateValue}
              icon="calendar"
              placeholder="Select year"
              options={YEARS.map((year) => ({ value: year, label: year }))}
            />
            <SelectField
              label="Block"
              name="block"
              value={values.block}
              onChange={updateValue}
              icon="grid"
              placeholder="Select block"
              options={BLOCKS.map((block) => ({ value: block, label: `Block ${block}` }))}
              className="block sm:col-span-2"
            />
          </div>
        ) : null}

        <InputField
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={values.password}
          onChange={updateValue}
          icon="lock"
          placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={8}
          endAdornment={passwordAdornment}
        />

        {isRegister ? (
          <label className="flex cursor-pointer items-start gap-3 pt-1">
            <input
              name="terms"
              type="checkbox"
              checked={values.terms}
              onChange={updateValue}
              className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
              required
            />
            <span className="text-xs leading-5 text-slate-500">
              I confirm that the information above is accurate and agree to the NextGen community terms.
            </span>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className={`${BTN_PRIMARY} group h-12 w-full focus:outline-none focus:ring-4 focus:ring-blue-500/20`}
        >
          {pending ? <Icon name="loader" className="h-4.5 w-4.5 animate-spin" /> : null}
          {pending ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          {!pending ? <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
        </button>
      </form>

      <div className={`my-7 flex items-center gap-3 ${MICRO}`}>
        <span className="h-px flex-1 bg-slate-200" />
        <span>{isRegister ? "Already registered?" : "New to NextGen?"}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Link
        href={isRegister ? "/login" : "/register"}
        className={`${BTN_OUTLINE} h-12 w-full focus:outline-none focus:ring-4 focus:ring-blue-500/10`}
      >
        {isRegister ? "Sign in to your account" : "Create a new account"}
      </Link>
    </div>
  );
}