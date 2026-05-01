import { NextResponse } from "next/server";
import { requestModuleRevision } from "@/lib/db/modules";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const moduleId = Number(id);

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ ok: false, error: "Invalid module id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const comment = typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim()
      : "Нужны правки по файлу.";

    await requestModuleRevision({ moduleId, actorUserId: session.userId, comment });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
