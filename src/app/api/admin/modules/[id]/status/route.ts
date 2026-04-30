import { NextResponse } from "next/server";
import type { ModuleStatus } from "@/lib/domain";
import { moduleStatuses } from "@/lib/domain";
import { updateModuleStatus, logModuleActivity } from "@/lib/db/modules";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const moduleId = Number(id);

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ ok: false, error: "Invalid module id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body.status as ModuleStatus | undefined;

    if (!status || !(status in moduleStatuses)) {
      return NextResponse.json({ ok: false, error: "Invalid module status." }, { status: 400 });
    }

    await updateModuleStatus({
      moduleId,
      status,
      managerComment: typeof body.comment === "string" ? body.comment : null,
      acceptedByUserId: status === "accepted" ? session.userId : null,
    });
    await logModuleActivity({ moduleId, actorUserId: session.userId, action: "module.status_changed", details: { status } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
