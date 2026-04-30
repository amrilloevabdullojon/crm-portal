import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/lib/domain";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/db/supabase";
import { normalizePhone } from "@/lib/auth/phone";
import { sendTelegramMessage } from "@/lib/telegram/client";

type AuthUser = {
  id: number;
  role: UserRole;
  telegram_chat_id: string | null;
  clinic_users?: { clinic_id: number }[];
};

type AuthChallengeRecord = {
  id: string;
  userId: number;
  phone: string;
  codeHash: string;
  expiresAt: number;
};

const demoChallenges = new Map<string, AuthChallengeRecord>();
const demoUsers = new Map<string, AuthUser>([
  [
    "+998000000001",
    { id: 1, role: "admin", telegram_chat_id: null, clinic_users: [{ clinic_id: 1 }] },
  ],
  [
    "+998000000002",
    { id: 2, role: "client", telegram_chat_id: null, clinic_users: [{ clinic_id: 1 }] },
  ],
]);

function makeCode() {
  return String(randomInt(100000, 1000000));
}

function getHashSecret() {
  return process.env.AUTH_SESSION_SECRET || "development-only-dmed-session-secret";
}

function hashCode(code: string) {
  return createHash("sha256").update(`${code}:${getHashSecret()}`).digest("hex");
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

async function findUserByPhone(phone: string): Promise<AuthUser | null> {
  if (!hasSupabaseAdminConfig()) {
    return demoUsers.get(phone) ?? null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,role,telegram_chat_id,clinic_users(clinic_id)")
    .eq("phone", phone)
    .eq("is_active", true)
    .single<AuthUser>();

  if (error || !data) return null;

  return data;
}

async function sendChallengeCode(user: AuthUser, code: string) {
  if (!user.telegram_chat_id || !process.env.TELEGRAM_BOT_TOKEN) {
    return { delivered: false };
  }

  await sendTelegramMessage(user.telegram_chat_id, `Код входа в DMED Portal: ${code}`);
  return { delivered: true };
}

export async function startAuthChallenge(rawPhone: string) {
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    return { ok: false as const, error: "Phone is required." };
  }

  const user = await findUserByPhone(phone);

  if (!user) {
    return { ok: false as const, error: "User was not found." };
  }

  const code = makeCode();
  const codeHash = hashCode(code);
  const expiresAt = Date.now() + 10 * 60 * 1000;

  if (!hasSupabaseAdminConfig()) {
    const challengeId = randomUUID();
    demoChallenges.set(challengeId, {
      id: challengeId,
      userId: user.id,
      phone,
      codeHash,
      expiresAt,
    });

    return {
      ok: true as const,
      challengeId,
      delivered: false,
      devCode: isDevelopment() ? code : undefined,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("auth_challenges")
    .insert({
      user_id: user.id,
      phone,
      code_hash: codeHash,
      expires_at: new Date(expiresAt).toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(`Auth challenge insert failed: ${error?.message}`);
  }

  const delivery = await sendChallengeCode(user, code);

  return {
    ok: true as const,
    challengeId: data.id,
    delivered: delivery.delivered,
    devCode: isDevelopment() && !delivery.delivered ? code : undefined,
  };
}

export async function verifyAuthChallenge(input: { challengeId: string; code: string }) {
  const codeHash = hashCode(input.code.trim());

  if (!hasSupabaseAdminConfig()) {
    const challenge = demoChallenges.get(input.challengeId);

    if (!challenge || challenge.expiresAt <= Date.now() || !hashesMatch(challenge.codeHash, codeHash)) {
      return { ok: false as const, error: "Invalid or expired code." };
    }

    demoChallenges.delete(input.challengeId);
    const user = [...demoUsers.values()].find((item) => item.id === challenge.userId);

    if (!user) {
      return { ok: false as const, error: "User was not found." };
    }

    return {
      ok: true as const,
      session: {
        userId: user.id,
        role: user.role,
        clinicId: user.clinic_users?.[0]?.clinic_id,
      },
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("auth_challenges")
    .select("id,user_id,code_hash,expires_at,consumed_at,users(id,role,clinic_users(clinic_id))")
    .eq("id", input.challengeId)
    .single<{
      id: string;
      user_id: number;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      users: AuthUser | AuthUser[] | null;
    }>();

  const user = Array.isArray(data?.users) ? data?.users[0] : data?.users;

  if (
    error ||
    !data ||
    !user ||
    data.consumed_at ||
    new Date(data.expires_at).getTime() <= Date.now() ||
    !hashesMatch(data.code_hash, codeHash)
  ) {
    return { ok: false as const, error: "Invalid or expired code." };
  }

  await supabase.from("auth_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);

  return {
    ok: true as const,
    session: {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_users?.[0]?.clinic_id,
    },
  };
}
