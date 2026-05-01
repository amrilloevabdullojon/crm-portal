import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/lib/domain";
import { createActivityLog } from "@/lib/db/activity";
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
  failedAttempts?: number;
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

function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || undefined;
}

async function isPhoneRateLimited(phone: string) {
  if (!hasSupabaseAdminConfig()) return false;

  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("auth_challenges")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", since);

  if (error) {
    console.warn("Auth rate limit query failed:", error.message);
    return false;
  }

  return (count ?? 0) >= 5;
}

async function isVerifyRateLimited(challengeId: string) {
  if (!hasSupabaseAdminConfig() || !challengeId) return false;

  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "auth.verify_failed")
    .eq("details->>challengeId", challengeId)
    .gte("created_at", since);

  if (error) {
    console.warn("Auth verify rate limit query failed:", error.message);
    return false;
  }

  return (count ?? 0) >= 5;
}

export async function startAuthChallenge(rawPhone: string) {
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    await createActivityLog({
      action: "auth.challenge_rejected",
      details: { reason: "missing_phone" },
    });
    return { ok: false as const, error: "Phone is required." };
  }

  const user = await findUserByPhone(phone);

  if (!user) {
    await createActivityLog({
      action: "auth.challenge_rejected",
      details: { phone, reason: "user_not_found" },
    });
    return { ok: false as const, error: "User was not found." };
  }

  if (!isDevelopment() && !user.telegram_chat_id) {
    await createActivityLog({
      actorUserId: user.id,
      action: "auth.challenge_rejected",
      details: { phone, reason: "telegram_not_linked" },
    });
    return {
      ok: false as const,
      code: "telegram_not_linked",
      error: "Telegram is not linked for this phone.",
      telegramBotUsername: getTelegramBotUsername(),
    };
  }

  if (!isDevelopment() && !process.env.TELEGRAM_BOT_TOKEN) {
    await createActivityLog({
      actorUserId: user.id,
      action: "auth.challenge_rejected",
      details: { phone, reason: "telegram_not_configured" },
    });
    return {
      ok: false as const,
      code: "telegram_not_configured",
      error: "Telegram delivery is not configured.",
    };
  }

  if (await isPhoneRateLimited(phone)) {
    await createActivityLog({
      actorUserId: user.id,
      action: "auth.challenge_rate_limited",
      details: { phone },
    });
    return {
      ok: false as const,
      code: "rate_limited",
      error: "Too many code requests. Try again in 10 minutes.",
    };
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

  let delivery: Awaited<ReturnType<typeof sendChallengeCode>>;
  try {
    delivery = await sendChallengeCode(user, code);
  } catch (error) {
    console.warn("Telegram auth code delivery failed:", error);
    await createActivityLog({
      actorUserId: user.id,
      action: "auth.challenge_delivery_failed",
      details: { phone },
    });
    return {
      ok: false as const,
      code: "telegram_delivery_failed",
      error: "Failed to send Telegram login code.",
      telegramBotUsername: getTelegramBotUsername(),
    };
  }

  await createActivityLog({
    actorUserId: user.id,
    action: "auth.challenge_started",
    details: { phone, delivered: delivery.delivered },
  });

  return {
    ok: true as const,
    challengeId: data.id,
    delivered: delivery.delivered,
    devCode: isDevelopment() && !delivery.delivered ? code : undefined,
    telegramBotUsername: getTelegramBotUsername(),
  };
}

export async function verifyAuthChallenge(input: { challengeId: string; code: string }) {
  const codeHash = hashCode(input.code.trim());

  if (!hasSupabaseAdminConfig()) {
    const challenge = demoChallenges.get(input.challengeId);

    if (challenge && (challenge.failedAttempts ?? 0) >= 5) {
      return {
        ok: false as const,
        code: "verify_rate_limited",
        error: "Too many invalid code attempts. Request a new code in 10 minutes.",
      };
    }

    if (!challenge || challenge.expiresAt <= Date.now() || !hashesMatch(challenge.codeHash, codeHash)) {
      if (challenge) {
        challenge.failedAttempts = (challenge.failedAttempts ?? 0) + 1;
        if (challenge.failedAttempts >= 5) {
          return {
            ok: false as const,
            code: "verify_rate_limited",
            error: "Too many invalid code attempts. Request a new code in 10 minutes.",
          };
        }
      }

      return { ok: false as const, code: "invalid_code", error: "Invalid or expired code." };
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

  if (await isVerifyRateLimited(input.challengeId)) {
    await createActivityLog({
      action: "auth.verify_rate_limited",
      details: { challengeId: input.challengeId },
    });
    return {
      ok: false as const,
      code: "verify_rate_limited",
      error: "Too many invalid code attempts. Request a new code in 10 minutes.",
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
    await createActivityLog({
      actorUserId: data?.user_id ?? null,
      action: "auth.verify_failed",
      details: { challengeId: input.challengeId },
    });
    return { ok: false as const, code: "invalid_code", error: "Invalid or expired code." };
  }

  await supabase.from("auth_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);

  await createActivityLog({
    actorUserId: user.id,
    clinicId: user.clinic_users?.[0]?.clinic_id,
    action: "auth.login_success",
    details: { role: user.role },
  });

  return {
    ok: true as const,
    session: {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_users?.[0]?.clinic_id,
    },
  };
}
