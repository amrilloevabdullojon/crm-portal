"use server";

import { revalidatePath } from "next/cache";
import { updateModuleStatus, logModuleActivity } from "@/lib/db/modules";
import { requireRole } from "@/lib/auth/guards";

export async function acceptModuleAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const moduleId = Number(formData.get("moduleId"));

  if (!Number.isFinite(moduleId)) {
    throw new Error("Invalid module id.");
  }

  await updateModuleStatus({ moduleId, status: "accepted", acceptedByUserId: session.userId });
  await logModuleActivity({ moduleId, actorUserId: session.userId, action: "module.accepted" });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function requestRevisionAction(formData: FormData) {
  const session = await requireRole(["admin", "manager"]);
  const moduleId = Number(formData.get("moduleId"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!Number.isFinite(moduleId)) {
    throw new Error("Invalid module id.");
  }

  await updateModuleStatus({
    moduleId,
    status: "needs_revision",
    managerComment: comment || "Нужны правки по файлу.",
  });
  await logModuleActivity({
    moduleId,
    actorUserId: session.userId,
    action: "module.revision_requested",
    details: { comment },
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
}
