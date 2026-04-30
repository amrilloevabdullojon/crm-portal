"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "phone" | "code";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+998000000002");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function startChallenge() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const result = await response.json().catch(() => ({}));

    setLoading(false);

    if (!response.ok) {
      setMessage(result.error ?? "Не удалось отправить код.");
      return;
    }

    setChallengeId(result.challengeId);
    setCode(result.devCode ?? "");
    setStep("code");
    setMessage(result.devCode ? `Dev code: ${result.devCode}` : "Код отправлен в Telegram.");
  }

  async function verifyCode() {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId, code }),
    });
    const result = await response.json().catch(() => ({}));

    setLoading(false);

    if (!response.ok) {
      setMessage(result.error ?? "Неверный код.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Телефон</span>
        <input
          className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3 outline-none focus:border-[var(--primary)]"
          disabled={step === "code"}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+998..."
          type="tel"
          value={phone}
        />
      </label>

      {step === "code" ? (
        <label className="block">
          <span className="text-sm font-medium">Код</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3 outline-none focus:border-[var(--primary)]"
            inputMode="numeric"
            onChange={(event) => setCode(event.target.value)}
            placeholder="000000"
            value={code}
          />
        </label>
      ) : null}

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      {step === "phone" ? (
        <button
          className="h-11 w-full rounded-md bg-[var(--primary)] text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          onClick={startChallenge}
          type="button"
        >
          {loading ? "Отправляем..." : "Получить код"}
        </button>
      ) : (
        <div className="grid gap-3">
          <button
            className="h-11 w-full rounded-md bg-[var(--primary)] text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading}
            onClick={verifyCode}
            type="button"
          >
            {loading ? "Проверяем..." : "Войти"}
          </button>
          <button
            className="h-11 w-full rounded-md border border-[var(--border)] text-sm font-semibold"
            onClick={() => {
              setStep("phone");
              setChallengeId("");
              setCode("");
              setMessage("");
            }}
            type="button"
          >
            Изменить телефон
          </button>
        </div>
      )}
    </div>
  );
}
