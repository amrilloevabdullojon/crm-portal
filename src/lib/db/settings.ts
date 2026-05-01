import { getAmoTargetStatusIds } from "@/lib/amocrm/parser";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

const amoStatusSettingsEventType = "amocrm_status_settings";

export type AmoStatusSettings = {
  targetStatusIds: string[];
  source: "db" | "env";
  updatedAt?: string;
  updatedByUserId?: number;
};

function parseStatusIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStatusIds(statusIds: string[]) {
  return [...new Set(statusIds.map((statusId) => statusId.trim()).filter(Boolean))];
}

function envStatusSettings(): AmoStatusSettings {
  return {
    targetStatusIds: getAmoTargetStatusIds(),
    source: "env",
  };
}

export async function getAmoStatusSettings(): Promise<AmoStatusSettings> {
  if (!hasSupabaseAdminConfig()) return envStatusSettings();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integration_events")
    .select("payload,created_at")
    .eq("provider", "amo")
    .eq("event_type", amoStatusSettingsEventType)
    .eq("status", "processed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      payload: {
        targetStatusIds?: unknown;
        updatedByUserId?: unknown;
      } | null;
      created_at: string;
    }>();

  if (error) {
    console.warn("amoCRM status settings lookup failed:", error.message);
    return envStatusSettings();
  }

  const targetStatusIds = Array.isArray(data?.payload?.targetStatusIds)
    ? normalizeStatusIds(data.payload.targetStatusIds.map(String))
    : [];

  if (targetStatusIds.length === 0) return envStatusSettings();

  return {
    targetStatusIds,
    source: "db",
    updatedAt: data?.created_at,
    updatedByUserId:
      typeof data?.payload?.updatedByUserId === "number" ? data.payload.updatedByUserId : undefined,
  };
}

export async function setAmoStatusSettings(input: { rawStatusIds: string; actorUserId?: number | null }) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const targetStatusIds = normalizeStatusIds(parseStatusIds(input.rawStatusIds));

  if (targetStatusIds.length === 0) {
    throw new Error("At least one amoCRM status id is required.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("integration_events").insert({
    provider: "amo",
    event_type: amoStatusSettingsEventType,
    payload: {
      targetStatusIds,
      updatedByUserId: input.actorUserId ?? null,
    },
    status: "processed",
    processed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`amoCRM status settings update failed: ${error.message}`);
  }

  return { ok: true, demo: false, targetStatusIds };
}
