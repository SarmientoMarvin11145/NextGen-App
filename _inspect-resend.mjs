import { readFileSync } from "node:fs";

const source = readFileSync("node_modules/resend/dist/index.d.mts", "utf8");
const needles = ["replyTo", "CreateEmailOptions", "CreateEmailResponseSuccess", "emails: Emails", "send:", "LooseUnion", "from: string", "text?", "html?"];

for (const needle of needles) {
  const index = source.indexOf(needle);
  console.log(`\n=== ${needle} @ ${index} ===`);
  if (index >= 0) console.log(source.slice(Math.max(0, index - 900), index + 900));
}

const respType = source.indexOf("Response<T> =");
console.log("\n=== Response type ===");
console.log(source.slice(Math.max(0, respType - 200), respType + 400));

const ctor = source.indexOf("constructor(key?");
console.log("\n=== constructor ===");
console.log(source.slice(ctor, ctor + 300));

// Live probe: an invalid key shows the exact response shape the helper sees.
const { Resend } = await import("resend");
const client = new Resend("re_invalid_probe_key");
try {
  const result = await client.emails.send({
    from: "onboarding@resend.dev",
    to: "marvinsarmiento847@gmail.com",
    subject: "Hello World",
    html: "<p>probe</p>",
  });
  console.log("\n=== live probe result ===");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log("\n=== live probe threw ===", error?.message);
}

try {
  new Resend();
} catch (error) {
  console.log("=== new Resend() with no key throws ===", error?.message);
}
