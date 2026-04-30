import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const update = await request.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    provider: "telegram",
    message: "Telegram webhook handling is not implemented yet.",
    received: Boolean(update),
  });
}
