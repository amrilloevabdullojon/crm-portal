import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Вход в портал</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Введите телефон. Код входа придет в Telegram после привязки номера к боту.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
