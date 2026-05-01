import { NextResponse } from "next/server";
import { acceptModule } from "@/lib/db/modules";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const moduleId = Number(id);

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ ok: false, error: "Invalid module id." }, { status: 400 });
    }

    const result = await acceptModule({ moduleId, actorUserId: session.userId });

    return NextResponse.json({ ok: true, actualCopy: result.actualCopy ?? null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
