export type EnvGroup = {
  name: string;
  required: string[];
  optional?: string[];
};

export const envGroups: EnvGroup[] = [
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
    required: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
  },
  {
    name: "amoCRM",
    required: ["AMOCRM_DOMAIN", "AMOCRM_ACCESS_TOKEN", "AMOCRM_WEBHOOK_SECRET"],
  },
];

export function getEnvStatus() {
  return envGroups.map((group) => {
    const missing = group.required.filter((key) => !process.env[key]);

    return {
      name: group.name,
      configured: missing.length === 0,
      missing,
    };
  });
}

export function getMissingEnvVars() {
  return getEnvStatus().flatMap((group) => group.missing);
}
