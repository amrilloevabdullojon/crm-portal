import { NextResponse } from "next/server";
import { startAuthChallenge } from "@/lib/auth/challenges";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await startAuthChallenge(String(body.phone ?? ""));

  if (!result.ok) {
    const status = "code" in result && result.code === "rate_limited" ? 429 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
