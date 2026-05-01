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
