"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "phone" | "code";
type MessageTone = "info" | "error" | "success";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/portal";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmitPhone = phone.trim().length >= 7 && !loading;
  const canSubmitCode = code.trim().length >= 4 && !loading;

  async function startChallenge() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTelegramBotUsername(result.telegramBotUsername ?? "");
        setMessageTone("error");
        setMessage(
          result.code === "telegram_not_linked"
            ? "Telegram не привязан к этому номеру. Откройте бота и отправьте номер через кнопку контакта."
            : result.error ?? "Не удалось отправить код.",
        );
        return;
      }

      setChallengeId(result.challengeId);
      setCode(result.devCode ?? "");
      setStep("code");
      setTelegramBotUsername(result.telegramBotUsername ?? "");
      setMessageTone(result.delivered ? "success" : "info");
      setMessage(
        result.devCode
          ? `Dev code: ${result.devCode}`
          : result.delivered
            ? "Код отправлен в Telegram."
            : "Код создан, но Telegram не подтвердил доставку.",
      );
    } catch {
      setMessageTone("error");
      setMessage("Не удалось связаться с сервером. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageTone("error");
        setMessage(result.error ?? "Неверный код.");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setMessageTone("error");
      setMessage("Не удалось проверить код. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "phone" && canSubmitPhone) void startChallenge();
        if (step === "code" && canSubmitCode) void verifyCode();
      }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <span className={step === "phone" ? "text-[var(--primary)]" : ""}>Телефон</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className={step === "code" ? "text-[var(--primary)]" : ""}>Код</span>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Телефон</span>
        <input
          autoComplete="tel"
          className="mt-2 h-12 w-full rounded-md border border-[var(--border)] bg-white px-3 text-base outline-none transition focus:border-[var(--primary)]"
          disabled={step === "code"}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+998..."
          type="tel"
          value={phone}
        />
      </label>

      {step === "code" ? (
        <label className="block">
          <span className="text-sm font-semibold">Код из Telegram</span>
          <input
            autoComplete="one-time-code"
            className="mt-2 h-12 w-full rounded-md border border-[var(--border)] bg-white px-3 text-center font-mono text-xl tracking-[0.18em] outline-none transition focus:border-[var(--primary)]"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            value={code}
          />
        </label>
      ) : null}

      {message ? (
        <div
          className={`space-y-3 rounded-md border px-3 py-3 text-sm ${
            messageTone === "error"
              ? "border-red-100 bg-red-50 text-[var(--danger)]"
              : messageTone === "success"
                ? "border-emerald-100 bg-emerald-50 text-[var(--success)]"
                : "border-blue-100 bg-blue-50 text-[var(--primary)]"
          }`}
        >
          <p>{message}</p>
          {telegramBotUsername ? (
            <a
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-3 font-semibold text-[var(--foreground)] shadow-sm"
              href={`https://t.me/${telegramBotUsername}`}
              rel="noreferrer"
              target="_blank"
            >
              Открыть Telegram-бота
            </a>
          ) : null}
        </div>
      ) : null}

      {step === "phone" ? (
        <button
          className="h-12 w-full rounded-md bg-[var(--primary)] text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmitPhone}
          type="submit"
        >
          {loading ? "Отправляем..." : "Получить код"}
        </button>
      ) : (
        <div className="grid gap-3">
          <button
            className="h-12 w-full rounded-md bg-[var(--primary)] text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmitCode}
            type="submit"
          >
            {loading ? "Проверяем..." : "Войти"}
          </button>
          <button
            className="h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
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
    </form>
  );
}
