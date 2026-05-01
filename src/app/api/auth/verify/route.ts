import { NextResponse } from "next/server";
import { verifyAuthChallenge } from "@/lib/auth/challenges";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await verifyAuthChallenge({
    challengeId: String(body.challengeId ?? ""),
    code: String(body.code ?? ""),
  });

  if (!result.ok) {
    const status = "code" in result && result.code === "verify_rate_limited" ? 429 : 400;
    return NextResponse.json(result, { status });
  }

  await setSessionCookie(result.session);

  return NextResponse.json({ ok: true, session: result.session });
}
