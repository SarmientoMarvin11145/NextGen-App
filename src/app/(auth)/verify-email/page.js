import VerifyEmailPanel from "@/components/auth/verify-email-panel";

export const metadata = {
  title: "Verify your email | NextGen",
  description: "Confirm your email address to activate your NextGen account.",
};

const STATUSES = new Set(["sent", "expired", "invalid"]);

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  const email = typeof params?.email === "string" ? params.email : "";
  const status = STATUSES.has(params?.status) ? params.status : "sent";

  return <VerifyEmailPanel email={email} status={status} />;
}

