import { NextResponse } from "next/server";
import { getPortalClinic } from "@/lib/db/clinics";
import { authErrorResponse, requireSession } from "@/lib/auth/guards";

export async function GET() {
  try {
    const session = await requireSession();
    const clinic = await getPortalClinic(session.clinicId ?? 1);

    return NextResponse.json({ clinic });
  } catch (error) {
    return authErrorResponse(error);
  }
}
