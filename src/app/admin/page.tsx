import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { clinicStatuses, moduleStatuses, type ModuleStatus } from "@/lib/domain";
import { listAdminClinics, listIntegrationEvents, type IntegrationEventRow } from "@/lib/db/admin";
import { acceptModuleAction, requestRevisionAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";

const moduleStatusTone: Record<ModuleStatus, string> = {
  collection: "bg-[var(--surface-muted)] text-[var(--muted)]",
  review: "bg-blue-50 text-[var(--primary)]",
  needs_revision: "bg-amber-50 text-[var(--warning)]",
  accepted: "bg-emerald-50 text-[var(--success)]",
};

const eventStatusTone: Record<IntegrationEventRow["status"], string> = {
  received: "bg-blue-50 text-[var(--primary)]",
  processed: "bg-emerald-50 text-[var(--success)]",
  ignored: "bg-slate-100 text-[var(--muted)]",
  failed: "bg-red-50 text-[var(--danger)]",
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const [clinics, events] = await Promise.all([listAdminClinics(), listIntegrationEvents(12)]);
  const reviewItems = clinics.flatMap((clinic) =>
    clinic.modules
      .filter((module) => module.status === "review" || module.status === "needs_revision")
      .map((module) => ({ clinic, module })),
  );
  const failedEvents = events.filter((event) => event.status === "failed").length;
  const linkedUsers = clinics.flatMap((clinic) => clinic.users).filter((user) => user.telegramLinked).length;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Админ-панель</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Клиники, модули, файлы и события интеграций.</p>
          </div>
          <Link className="text-sm font-semibold text-[var(--primary)]" href="/admin/events">
            Все события
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-sm text-[var(--muted)]">Клиники</div>
            <div className="mt-2 text-3xl font-semibold">{clinics.length}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-sm text-[var(--muted)]">На проверке</div>
            <div className="mt-2 text-3xl font-semibold">{reviewItems.length}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-sm text-[var(--muted)]">Telegram привязан</div>
            <div className="mt-2 text-3xl font-semibold">{linkedUsers}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="text-sm text-[var(--muted)]">Ошибки интеграций</div>
            <div className="mt-2 text-3xl font-semibold">{failedEvents}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-semibold">Клиники</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Клиника</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    <th className="px-5 py-3 font-medium">Модули</th>
                    <th className="px-5 py-3 font-medium">Контакты</th>
                    <th className="px-5 py-3 font-medium">Создана</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {clinics.map((clinic) => {
                    const waiting = clinic.modules.filter((module) => module.status === "review").length;
                    const accepted = clinic.modules.filter((module) => module.status === "accepted").length;

                    return (
                      <tr key={clinic.id}>
                        <td className="px-5 py-4">
                          <Link className="font-semibold text-[var(--primary)]" href={`/admin/clinics/${clinic.id}`}>
                            {clinic.name}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-[var(--muted)]">
                            amo: {clinic.amoDealId ?? "не задано"}
                          </div>
                        </td>
                        <td className="px-5 py-4">{clinicStatuses[clinic.status] ?? clinic.status}</td>
                        <td className="px-5 py-4">
                          {accepted}/{clinic.modules.length} принято
                          {waiting ? <div className="mt-1 text-xs text-[var(--primary)]">{waiting} на проверке</div> : null}
                        </td>
                        <td className="px-5 py-4">{clinic.users.length}</td>
                        <td className="px-5 py-4 text-[var(--muted)]">{formatDate(clinic.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {clinics.length === 0 ? (
                    <tr>
                      <td className="px-5 py-8 text-center text-[var(--muted)]" colSpan={5}>
                        Клиник пока нет.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-semibold">События</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {events.slice(0, 8).map((event) => (
                <div key={event.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-xs text-[var(--muted)]">#{event.id} {event.provider}</div>
                    <Badge className={eventStatusTone[event.status]}>{event.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm">{event.externalId ?? event.eventType ?? "event"}</div>
                  {event.errorMessage ? <div className="mt-1 text-xs text-[var(--danger)]">{event.errorMessage}</div> : null}
                  <div className="mt-2 text-xs text-[var(--muted)]">{formatDate(event.createdAt)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold">Очередь менеджера</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {reviewItems.map(({ clinic, module }) => (
              <div key={`${clinic.id}-${module.id}`} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Link className="text-sm text-[var(--primary)]" href={`/admin/clinics/${clinic.id}`}>
                    {clinic.name}
                  </Link>
                  <div className="mt-1 font-semibold">{module.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={moduleStatusTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                    {module.files[0]?.fileUrl ? (
                      <a className="text-sm font-semibold text-[var(--primary)]" href={module.files[0].fileUrl} rel="noreferrer" target="_blank">
                        Открыть файл
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <form action={acceptModuleAction}>
                    <input name="moduleId" type="hidden" value={module.id} />
                    <input name="clinicId" type="hidden" value={clinic.id} />
                    <button className="h-10 rounded-md bg-[var(--success)] px-4 text-sm font-semibold text-white" type="submit">
                      Принять
                    </button>
                  </form>
                  <form action={requestRevisionAction} className="flex gap-2">
                    <input name="moduleId" type="hidden" value={module.id} />
                    <input name="clinicId" type="hidden" value={clinic.id} />
                    <input
                      className="h-10 w-56 rounded-md border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]"
                      name="comment"
                      placeholder="Комментарий"
                    />
                    <button className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold" type="submit">
                      Правки
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {reviewItems.length === 0 ? <div className="p-8 text-center text-sm text-[var(--muted)]">Очередь пуста.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
