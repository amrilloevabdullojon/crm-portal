import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-10">
        <nav className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm">
          <div>
            <div className="text-lg font-semibold">DMED Portal</div>
            <div className="text-sm text-[var(--muted)]">new service scaffold</div>
          </div>
          <div className="flex gap-3 text-sm font-medium">
            <Link className="rounded-md border border-[var(--border)] px-4 py-2" href="/login">
              Login
            </Link>
            <Link className="rounded-md bg-[var(--primary)] px-4 py-2 text-white" href="/admin">
              Admin
            </Link>
          </div>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight">
              Новый web-сервис для клиентского портала и менеджерского контроля.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Apps Script остается legacy-слоем. Новый сервис берет на себя авторизацию,
              роли, статусы модулей, загрузку файлов в Google Drive и интеграции с
              Telegram и amoCRM.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-md bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/portal">
                Client portal
              </Link>
              <Link className="rounded-md border border-[var(--border)] px-5 py-3 text-sm font-semibold" href="/admin">
                Manager dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="text-sm font-semibold uppercase text-[var(--muted)]">MVP surface</div>
            <div className="mt-5 space-y-4">
              {[
                "Phone or Telegram login",
                "Clinic-scoped client portal",
                "Google Drive file storage",
                "Module review queue",
                "amoCRM and Telegram webhooks",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-[var(--border)] pb-3 last:border-0">
                  <span className="text-sm">{item}</span>
                  <span className="rounded bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--muted)]">planned</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
