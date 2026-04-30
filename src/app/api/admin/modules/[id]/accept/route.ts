import { NextResponse } from "next/server";
import { updateModuleStatus, logModuleActivity } from "@/lib/db/modules";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const moduleId = Number(id);

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ ok: false, error: "Invalid module id." }, { status: 400 });
    }

    await updateModuleStatus({ moduleId, status: "accepted", acceptedByUserId: session.userId });
    await logModuleActivity({ moduleId, actorUserId: session.userId, action: "module.accepted" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
