import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export type ActivityLogRow = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  actorName?: string;
  clinicName?: string;
  moduleName?: string;
};

export type CreateActivityLogInput = {
  actorUserId?: number | null;
  clinicId?: number | null;
  moduleId?: number | null;
  action: string;
  details?: Record<string, unknown>;
};

const portalActivityActions = ["module.file_uploaded", "module.accepted", "module.revision_requested"] as const;

type RawActivityLogRow = {
  id: number;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  users: { name: string | null; phone: string | null } | { name: string | null; phone: string | null }[] | null;
  clinics: { name: string } | { name: string }[] | null;
  clinic_modules: { name: string } | { name: string }[] | null;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapActivity(row: RawActivityLogRow): ActivityLogRow {
  const actor = first(row.users);
  const clinic = first(row.clinics);
  const activityModule = first(row.clinic_modules);

  return {
    id: row.id,
    action: row.action,
    details: row.details ?? {},
    createdAt: row.created_at,
    actorName: actor?.name || actor?.phone || undefined,
    clinicName: clinic?.name,
    moduleName: activityModule?.name,
  };
}

export async function listActivityLog(input: { clinicId?: number; limit?: number } = {}) {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("activity_log")
    .select(`
      id,
      action,
      details,
      created_at,
      users (
        name,
        phone
      ),
      clinics (
        name
      ),
      clinic_modules (
        name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 30);

  if (input.clinicId) {
    query = query.eq("clinic_id", input.clinicId);
  }

  const { data, error } = await query.returns<RawActivityLogRow[]>();

  if (error || !data) {
    throw new Error(`Activity log query failed: ${error?.message}`);
  }

  return data.map(mapActivity);
}

export async function listPortalActivityLog(input: { clinicId: number; limit?: number }) {
  if (!Number.isFinite(input.clinicId)) return [];

  if (!hasSupabaseAdminConfig()) {
    return [
      {
        id: 3,
        action: "module.revision_requested",
        details: { comment: "Нужен файл с актуальными должностями." },
        createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        actorName: "DMED",
        clinicName: "Demo Clinic",
        moduleName: "Врачи",
      },
      {
        id: 2,
        action: "module.file_uploaded",
        details: { fileName: "Прайс_v2_20260501_0900.xlsx" },
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        actorName: "Demo User",
        clinicName: "Demo Clinic",
        moduleName: "Прайс",
      },
      {
        id: 1,
        action: "module.accepted",
        details: { fileName: "Общая_информация_v1_20260430_1200.xlsx" },
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        actorName: "DMED",
        clinicName: "Demo Clinic",
        moduleName: "Общая информация",
      },
    ] satisfies ActivityLogRow[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select(`
      id,
      action,
      details,
      created_at,
      users (
        name,
        phone
      ),
      clinics (
        name
      ),
      clinic_modules (
        name
      )
    `)
    .eq("clinic_id", input.clinicId)
    .in("action", [...portalActivityActions])
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 12)
    .returns<RawActivityLogRow[]>();

  if (error || !data) {
    throw new Error(`Portal activity log query failed: ${error?.message}`);
  }

  return data.map(mapActivity);
}

export async function createActivityLog(input: CreateActivityLogInput) {
  if (!hasSupabaseAdminConfig()) return { ok: true, demo: true };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("activity_log").insert({
    actor_user_id: input.actorUserId ?? null,
    clinic_id: input.clinicId ?? null,
    module_id: input.moduleId ?? null,
    action: input.action,
    details: input.details ?? {},
  });

  if (error) {
    console.warn(`Activity log insert failed: ${error.message}`);
    return { ok: false, demo: false };
  }

  return { ok: true, demo: false };
}
