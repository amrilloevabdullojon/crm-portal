import { getAmoTargetStatusIds } from "@/lib/amocrm/parser";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { normalizeStatusIds, parseStatusIds } from "@/lib/settings-utils.mjs";

const amoStatusSettingsEventType = "amocrm_status_settings";
const amoStatusSettingsKey = "amocrm.target_status_ids";

export type AmoStatusSettings = {
  targetStatusIds: string[];
  source: "db" | "env";
  updatedAt?: string;
  updatedByUserId?: number;
};

function envStatusSettings(): AmoStatusSettings {
  return {
    targetStatusIds: getAmoTargetStatusIds(),
    source: "env",
  };
}

async function getAmoStatusSettingsFromSettingsTable(): Promise<AmoStatusSettings | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("integration_settings")
    .select("payload,updated_at,updated_by_user_id")
    .eq("key", amoStatusSettingsKey)
    .maybeSingle<{
      payload: { targetStatusIds?: unknown } | null;
      updated_at: string;
      updated_by_user_id: number | null;
    }>();

  if (error) {
    console.warn("integration_settings lookup failed:", error.message);
    return null;
  }

  const targetStatusIds = Array.isArray(data?.payload?.targetStatusIds)
    ? normalizeStatusIds(data.payload.targetStatusIds.map(String))
    : [];

  if (targetStatusIds.length === 0) return null;

  return {
    targetStatusIds,
    source: "db",
    updatedAt: data?.updated_at,
    updatedByUserId: data?.updated_by_user_id ?? undefined,
  };
}

async function getAmoStatusSettingsFromLegacyEvents(): Promise<AmoStatusSettings | null> {
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
    return null;
  }

  const targetStatusIds = Array.isArray(data?.payload?.targetStatusIds)
    ? normalizeStatusIds(data.payload.targetStatusIds.map(String))
    : [];

  if (targetStatusIds.length === 0) return null;

  return {
    targetStatusIds,
    source: "db",
    updatedAt: data?.created_at,
    updatedByUserId:
      typeof data?.payload?.updatedByUserId === "number" ? data.payload.updatedByUserId : undefined,
  };
}

export async function getAmoStatusSettings(): Promise<AmoStatusSettings> {
  if (!hasSupabaseAdminConfig()) return envStatusSettings();

  return (await getAmoStatusSettingsFromSettingsTable()) ?? (await getAmoStatusSettingsFromLegacyEvents()) ?? envStatusSettings();
}

async function setAmoStatusSettingsInSettingsTable(input: {
  targetStatusIds: string[];
  actorUserId?: number | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("integration_settings").upsert({
    key: amoStatusSettingsKey,
    payload: { targetStatusIds: input.targetStatusIds },
    updated_by_user_id: input.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("integration_settings update failed:", error.message);
    return false;
  }

  return true;
}

async function setAmoStatusSettingsInLegacyEvents(input: {
  targetStatusIds: string[];
  actorUserId?: number | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("integration_events").insert({
    provider: "amo",
    event_type: amoStatusSettingsEventType,
    payload: {
      targetStatusIds: input.targetStatusIds,
      updatedByUserId: input.actorUserId ?? null,
    },
    status: "processed",
    processed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`amoCRM status settings update failed: ${error.message}`);
  }
}

export async function setAmoStatusSettings(input: { rawStatusIds: string; actorUserId?: number | null }) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const targetStatusIds = normalizeStatusIds(parseStatusIds(input.rawStatusIds));

  if (targetStatusIds.length === 0) {
    throw new Error("At least one amoCRM status id is required.");
  }

  const savedToSettingsTable = await setAmoStatusSettingsInSettingsTable({
    targetStatusIds,
    actorUserId: input.actorUserId,
  });

  if (!savedToSettingsTable) {
    await setAmoStatusSettingsInLegacyEvents({
      targetStatusIds,
      actorUserId: input.actorUserId,
    });
  }

  return { ok: true, demo: false, targetStatusIds };
}
