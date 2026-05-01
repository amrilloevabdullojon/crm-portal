import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/config/env";
import { hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { hasSlackConfig } from "@/lib/slack/client";
import { hasTelegramSendConfig } from "@/lib/telegram/client";

export async function GET() {
  const checks = getEnvStatus();
  const supabaseConfigured = hasSupabaseAdminConfig();
  const slackConfigured = hasSlackConfig();
  const telegramSendConfigured = hasTelegramSendConfig();

  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    environment: process.env.NODE_ENV,
    integrations: [
      ...checks,
      {
        name: "Slack",
        configured: slackConfigured,
        missing: slackConfigured ? [] : ["SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN + SLACK_ADMIN_CHANNEL_ID"],
      },
      {
        name: "Telegram Send",
        configured: telegramSendConfigured,
        missing: telegramSendConfigured ? [] : ["TELEGRAM_BOT_TOKEN"],
      },
    ],
    databaseMode: supabaseConfigured ? "supabase" : "demo-fallback",
  });
}
