import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/domain";

export const sessionCookieName = "dmed_session";

export type AppSession = {
  userId: number;
  role: UserRole;
  clinicId?: number;
  expiresAt: string;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required in production.");
  }

  return "development-only-dmed-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function verifySignature(value: string, signature: string) {
  const expected = sign(value);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function encodeSession(session: AppSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw: string): AppSession | null {
  const [payload, signature] = raw.split(".");

  if (!payload || !signature || !verifySignature(payload, signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;

    if (!session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(sessionCookieName)?.value;

  if (!raw) return null;

  return decodeSession(raw);
}

export async function setSessionCookie(input: Omit<AppSession, "expiresAt"> & { maxAgeSeconds?: number }) {
  const maxAge = input.maxAgeSeconds ?? 60 * 60 * 24 * 7;
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, encodeSession({ ...input, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}
