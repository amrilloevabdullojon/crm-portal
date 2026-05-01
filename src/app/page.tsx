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
        <nav className="flex flex-col gap-4 rounded-xl glass-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between animate-slide-up stagger-1">
          <div>
            <div className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">DMED Portal</div>
            <div className="text-sm font-medium text-[var(--muted)] mt-1">Кабинет клиник и рабочее место менеджера</div>
          </div>
          <div className="flex gap-3 text-sm font-medium">
            <ButtonLink href="/login">Войти</ButtonLink>
            <ButtonLink href="/admin" variant="primary">Админка</ButtonLink>
          </div>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel className="p-6 sm:p-8">
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 pb-2">
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
                <div className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">Готовность MVP</div>
                <div className="mt-2 text-4xl font-black text-slate-800">100%</div>
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
                <div key={item.label} className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0 hover:bg-slate-50/50 p-2 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="rounded-full bg-[var(--success-bg)] px-3 py-1 text-xs font-bold text-[var(--success)] shadow-sm border border-emerald-100/50">
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
