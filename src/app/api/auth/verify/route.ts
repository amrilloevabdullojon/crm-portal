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
    return NextResponse.json(result, { status: 400 });
  }

  await setSessionCookie(result.session);

  return NextResponse.json({ ok: true, session: result.session });
}
