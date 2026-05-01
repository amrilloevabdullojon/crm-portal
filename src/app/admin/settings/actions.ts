"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { logModuleActivity } from "@/lib/db/modules";
import { setAmoStatusSettings } from "@/lib/db/settings";

export async function updateAmoStatusSettingsAction(formData: FormData) {
  const session = await requireRole(["admin"]);
  const rawStatusIds = String(formData.get("targetStatusIds") ?? "").trim();
  const result = await setAmoStatusSettings({ rawStatusIds, actorUserId: session.userId });

  await logModuleActivity({
    actorUserId: session.userId,
    action: "settings.amocrm_statuses_updated",
    details: {
      targetStatusIds: result.targetStatusIds ?? rawStatusIds,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/events");
}
