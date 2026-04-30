import { NextResponse } from "next/server";
import { startAuthChallenge } from "@/lib/auth/challenges";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await startAuthChallenge(String(body.phone ?? ""));

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
