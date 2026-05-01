import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { Panel } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:px-8">
      <section className="mx-auto flex w-full max-w-xl flex-col justify-center lg:ml-auto">
        <div className="mb-6">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">DMED Portal</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Вход для клиник и менеджеров</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted)]">
            Введите номер, получите код в Telegram и продолжайте работу с модулями, файлами и проверками.
          </p>
        </div>
        <Panel className="p-5 sm:p-6">
          <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-[var(--primary)]">
            Доступ открывается только для номеров, которые уже есть в amoCRM и подтверждены через Telegram-контакт.
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </Panel>
      </section>

      <aside className="mx-auto mt-6 flex w-full max-w-xl flex-col justify-center lg:mr-auto lg:mt-0">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <div className="text-sm font-semibold text-[var(--muted)]">Как устроен доступ</div>
            <h2 className="mt-2 text-xl font-semibold">Вход без ручной подмены номера</h2>
          </div>
          <div className="space-y-4 px-6 py-5">
            {[
              ["1", "Отправьте свой номер в Telegram-боте через кнопку контакта."],
              ["2", "Запросите код на этой странице. Код придет в тот же Telegram."],
              ["3", "Код действует 10 минут. После нескольких неверных попыток вход временно блокируется."],
              ["4", "После входа система откроет кабинет клиники или админ-панель по роли."],
            ].map(([step, text]) => (
              <div key={step} className="flex gap-3 rounded-md border border-[var(--border)] bg-white px-3 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-sm font-semibold text-[var(--foreground)]">
                  {step}
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">{text}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] bg-slate-50 px-6 py-4 text-xs leading-5 text-[var(--muted)]">
            Если номер не найден, попросите менеджера добавить контакт в сделку amoCRM.
          </div>
        </div>
      </aside>
    </main>
  );
}
