import Link from "next/link";
import { ButtonLink, PageShell, Panel, ProgressBar } from "@/components/ui";

export default function Home() {
  const features = [
    { label: "Авторизация через Telegram", status: "готово" },
    { label: "Кабинет клиники", status: "готово" },
    { label: "Загрузка файлов в Google Drive", status: "готово" },
    { label: "Очередь проверки менеджером", status: "готово" },
    { label: "Webhook amoCRM и Telegram", status: "готово" },
  ];

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <nav className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">DMED Portal</div>
            <div className="text-sm text-[var(--muted)]">Кабинет клиник и рабочее место менеджера</div>
          </div>
          <div className="flex gap-3 text-sm font-medium">
            <ButtonLink href="/login">Войти</ButtonLink>
            <ButtonLink href="/admin" variant="primary">Админка</ButtonLink>
          </div>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel className="p-6 sm:p-8">
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Единый портал для запуска клиник DMED.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Клиент загружает материалы по модулям, менеджер видит очередь проверки,
              статусы и ошибки интеграций. Файлы уходят в Google Drive, события приходят
              из amoCRM и Telegram.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/portal" variant="primary">Кабинет клиники</ButtonLink>
              <ButtonLink href="/admin">Рабочее место менеджера</ButtonLink>
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[var(--muted)]">Готовность MVP</div>
                <div className="mt-1 text-3xl font-semibold">100%</div>
              </div>
              <Link className="text-sm font-semibold text-[var(--primary)]" href="/admin/events">
                Мониторинг
              </Link>
            </div>
            <div className="mt-5">
              <ProgressBar value={100} />
            </div>
            <div className="mt-5 space-y-4">
              {features.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
