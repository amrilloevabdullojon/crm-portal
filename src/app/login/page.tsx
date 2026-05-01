import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { Panel } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:px-8">
      <section className="mx-auto flex w-full max-w-xl flex-col justify-center lg:ml-auto">
        <div className="mb-6">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">DMED Portal</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Вход для клиник и менеджеров</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted)]">
            Введите номер, получите код в Telegram и продолжайте работу с модулями, файлами и проверками.
          </p>
        </div>
        <Panel className="p-5 sm:p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </Panel>
      </section>

      <aside className="mx-auto mt-6 flex w-full max-w-xl flex-col justify-center lg:mr-auto lg:mt-0">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="text-sm font-semibold text-[var(--muted)]">Как устроен доступ</div>
          <div className="mt-5 space-y-4">
            {[
              ["1", "Отправьте свой номер в Telegram-боте через кнопку контакта."],
              ["2", "Запросите код на этой странице. Код придет в тот же Telegram."],
              ["3", "Код действует 10 минут. После нескольких неверных попыток вход временно блокируется."],
              ["4", "После входа система откроет кабинет клиники или админ-панель по роли."],
            ].map(([step, text]) => (
              <div key={step} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-sm font-semibold">
                  {step}
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
