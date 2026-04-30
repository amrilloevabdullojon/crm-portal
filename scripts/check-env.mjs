import fs from "node:fs";

function loadDotEnvLocal() {
  if (!fs.existsSync(".env.local")) return;

  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvLocal();

const groups = [
  {
    name: "Supabase",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "Auth",
    required: ["AUTH_SESSION_SECRET"],
  },
  {
    name: "Google Drive",
    required: [
      "GOOGLE_DRIVE_ROOT_FOLDER_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ],
  },
  {
    name: "Telegram",
    required: ["TELEGRAM_BOT_TOKEN"],
  },
  {
    name: "amoCRM",
    required: ["AMOCRM_DOMAIN", "AMOCRM_ACCESS_TOKEN", "AMOCRM_WEBHOOK_SECRET"],
  },
];

let missingTotal = 0;
let formatProblems = 0;

for (const group of groups) {
  const missing = group.required.filter((key) => !process.env[key]);
  const mark = missing.length === 0 ? "OK" : "MISSING";

  console.log(`${mark} ${group.name}`);

  if (missing.length > 0) {
    missingTotal += missing.length;
    for (const key of missing) console.log(`  - ${key}`);
  }
}

if (missingTotal > 0) {
  console.log(`\n${missingTotal} env var(s) missing.`);
  process.exitCode = 1;
} else {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const authSecret = process.env.AUTH_SESSION_SECRET || "";
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
    console.log("CHECK NEXT_PUBLIC_SUPABASE_URL should look like https://project-ref.supabase.co");
    formatProblems++;
  }

  if (!(supabaseKey.startsWith("sb_secret_") || supabaseKey.split(".").length === 3)) {
    console.log("CHECK SUPABASE_SERVICE_ROLE_KEY should be a Supabase secret/service-role key, not a publishable key.");
    formatProblems++;
  }

  if (authSecret.length < 32) {
    console.log("CHECK AUTH_SESSION_SECRET should be at least 32 characters.");
    formatProblems++;
  }

  if (!/^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(serviceEmail)) {
    console.log("CHECK GOOGLE_SERVICE_ACCOUNT_EMAIL should be a service account email.");
    formatProblems++;
  }

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    console.log("CHECK GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY should include private key markers.");
    formatProblems++;
  }

  if (formatProblems > 0) {
    console.log(`\n${formatProblems} format check(s) need attention.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll required env vars are configured.");
  }
}
