import type { ModuleStatus } from "@/lib/domain";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";

export type UpdateModuleStatusInput = {
  moduleId: number;
  status: ModuleStatus;
  managerComment?: string | null;
  acceptedByUserId?: number | null;
};

export async function updateModuleStatus(input: UpdateModuleStatusInput) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const patch: Record<string, string | number | null> = {
    status: input.status,
    manager_comment: input.managerComment ?? null,
  };

  if (input.status === "accepted") {
    patch.accepted_at = new Date().toISOString();
    patch.accepted_by_user_id = input.acceptedByUserId ?? null;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("clinic_modules").update(patch).eq("id", input.moduleId);

  if (error) {
    throw new Error(`Module status update failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}

export async function logModuleActivity(input: {
  actorUserId?: number | null;
  clinicId?: number | null;
  moduleId: number;
  action: string;
  details?: Record<string, unknown>;
}) {
  if (!hasSupabaseAdminConfig()) {
    return { ok: true, demo: true };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("activity_log").insert({
    actor_user_id: input.actorUserId ?? null,
    clinic_id: input.clinicId ?? null,
    module_id: input.moduleId,
    action: input.action,
    details: input.details ?? {},
  });

  if (error) {
    throw new Error(`Activity log insert failed: ${error.message}`);
  }

  return { ok: true, demo: false };
}
