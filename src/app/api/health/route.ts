import { NextResponse } from "next/server";
import { getEnvStatus } from "@/lib/config/env";
import { hasSupabaseAdminConfig } from "@/lib/db/supabase";

export async function GET() {
  const checks = getEnvStatus();
  const supabaseConfigured = hasSupabaseAdminConfig();

  return NextResponse.json({
    ok: true,
    runtime: "nodejs",
    environment: process.env.NODE_ENV,
    integrations: checks,
    databaseMode: supabaseConfigured ? "supabase" : "demo-fallback",
  });
}
