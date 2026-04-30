import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { listIntegrationEvents } from "@/lib/db/admin";

export async function GET() {
  try {
    await requireRole(["admin", "manager"]);
    const events = await listIntegrationEvents(80);

    return NextResponse.json({ events });
  } catch (error) {
    return authErrorResponse(error);
  }
}
