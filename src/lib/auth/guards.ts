import type { UserRole } from "@/lib/domain";
import { getSession } from "@/lib/auth/session";

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized.");
  }

  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireSession();

  if (!roles.includes(session.role)) {
    throw new Error("Forbidden.");
  }

  return session;
}

export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unauthorized.";

  if (message === "Forbidden.") {
    return Response.json({ ok: false, error: message }, { status: 403 });
  }

  if (message === "Unauthorized.") {
    return Response.json({ ok: false, error: message }, { status: 401 });
  }

  return Response.json({ ok: false, error: message }, { status: 500 });
}
