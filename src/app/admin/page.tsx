import Link from "next/link";
import { redirect } from "next/navigation";
import { clinicStatuses, moduleStatuses, type ModuleStatus } from "@/lib/domain";
import { listAdminClinics, listIntegrationEvents, type IntegrationEventRow } from "@/lib/db/admin";
import { acceptModuleAction, requestRevisionAction, syncAmoDealAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";
import { getSlaSummary } from "@/lib/sla";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, PageShell, Panel, ProgressBar, StatCard, TextLink } from "@/components/ui";

const moduleStatusTone: Record<ModuleStatus, "neutral" | "info" | "success" | "warning"> = {
  collection: "neutral",
  review: "info",
  needs_revision: "warning",
  accepted: "success",
};

const eventStatusTone: Record<IntegrationEventRow["status"], "neutral" | "info" | "success" | "danger"> = {
  received: "info",
  processed: "success",
  ignored: "neutral",
  failed: "danger",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function isGeneralInfoName(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("общ") || normalized.includes("general");
}

function isReviewOver24h(module: { name: string; status: ModuleStatus; files: Array<{ createdAt: string }> }) {
  if (!isGeneralInfoName(module.name) || module.status !== "review") return false;
  const latestFile = module.files[0];
  if (!latestFile) return false;

  return Date.now() - new Date(latestFile.createdAt).getTime() > 24 * 60 * 60 * 1000;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const params = await searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const moduleStatus = String(params.moduleStatus ?? "all");
  const slaFilter = String(params.sla ?? "all");
  const [allClinics, events] = await Promise.all([listAdminClinics(), listIntegrationEvents(12)]);
  const clinics = allClinics.filter((clinic) => {
    const matchesQuery =
      !query ||
      clinic.name.toLowerCase().includes(query) ||
      String(clinic.amoDealId ?? "").includes(query) ||
      clinic.users.some((user) => user.phone.includes(query) || user.name.toLowerCase().includes(query));
    const matchesModule =
      moduleStatus === "all" || clinic.modules.some((module) => module.status === moduleStatus);
    const sla = getSlaSummary(clinic.slaStartedAt);
    const matchesSla = slaFilter === "all" || (slaFilter === "active" && sla.active) || (slaFilter === "overdue" && sla.overdue);

    return matchesQuery && matchesModule && matchesSla;
  });
  const reviewItems = clinics.flatMap((clinic) =>
    clinic.modules
      .filter((module) => module.status === "review" || module.status === "needs_revision")
      .map((module) => ({ clinic, module })),
  );
  const failedEvents = events.filter((event) => event.status === "failed").length;
  const linkedUsers = clinics.flatMap((clinic) => clinic.users).filter((user) => user.telegramLinked).length;
  const activeSla = clinics.filter((clinic) => getSlaSummary(clinic.slaStartedAt).active).length;

  return (
    <PageShell wide>
      <div className="flex flex-col gap-6">
        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Рабочее место</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Админ-панель</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Контроль клиник, очереди проверки, Telegram-привязок и событий интеграций.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.role === "admin" ? <ButtonLink href="/admin/settings">Настройки</ButtonLink> : null}
              {session.role === "admin" ? <ButtonLink href="/admin/users">Пользователи</ButtonLink> : null}
              <ButtonLink href="/portal">Портал</ButtonLink>
              <ButtonLink href="/admin/events">События</ButtonLink>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-5">
          <StatCard hint={`Показано ${clinics.length} из ${allClinics.length}`} label="Клиники" tone="info" value={clinics.length} />
          <StatCard hint="Ожидают решения" label="На проверке" tone={reviewItems.length ? "warning" : "neutral"} value={reviewItems.length} />
          <StatCard hint="Контакты с кодами входа" label="Telegram привязан" tone="success" value={linkedUsers} />
          <StatCard hint="5 рабочих дней" label="SLA активны" tone={activeSla ? "info" : "neutral"} value={activeSla} />
          <StatCard hint="За последние события" label="Ошибки интеграций" tone={failedEvents ? "danger" : "neutral"} value={failedEvents} />
        </div>

        <Panel title="Быстрые действия">
          <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <form action="/admin" className="grid gap-3 rounded-md border border-[var(--border)] bg-slate-50 p-4 md:grid-cols-[1fr_0.8fr_0.8fr_auto] md:items-end">
              <label className="block">
                <span className="text-sm font-semibold">Поиск</span>
                <input className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]" defaultValue={String(params.q ?? "")} name="q" placeholder="Клиника, телефон, amo id" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Модуль</span>
                <select className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]" defaultValue={moduleStatus} name="moduleStatus">
                  <option value="all">Все</option>
                  <option value="collection">Сбор</option>
                  <option value="review">На проверке</option>
                  <option value="needs_revision">Правки</option>
                  <option value="accepted">Принято</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold">SLA</span>
                <select className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]" defaultValue={slaFilter} name="sla">
                  <option value="all">Все</option>
                  <option value="active">Активный</option>
                  <option value="overdue">Просрочен</option>
                </select>
              </label>
              <button className="h-10 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:bg-slate-50" type="submit">
                Фильтр
              </button>
            </form>

            <form action={syncAmoDealAction} className="grid gap-3 rounded-md border border-blue-100 bg-blue-50 p-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <span className="text-sm font-semibold">Синхронизировать сделку amoCRM</span>
                <input className="mt-2 h-10 w-full rounded-md border border-blue-100 bg-white px-3 font-mono text-sm outline-none focus:border-[var(--primary)]" name="dealId" placeholder="amo deal id" required />
              </label>
              <button className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)]" type="submit">
                Sync
              </button>
            </form>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Клиники">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-left text-sm sm:min-w-[760px]">
                <thead className="border-b border-[var(--border)] bg-slate-50 text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Клиника</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    <th className="px-5 py-3 font-medium">Модули</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">Контакты</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">Создана</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {clinics.map((clinic) => {
                    const waiting = clinic.modules.filter((module) => module.status === "review").length;
                    const accepted = clinic.modules.filter((module) => module.status === "accepted").length;
                    const progress = clinic.modules.length > 0 ? Math.round((accepted / clinic.modules.length) * 100) : 0;
                    const sla = getSlaSummary(clinic.slaStartedAt);

                    return (
                      <tr key={clinic.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <Link className="font-semibold text-[var(--primary)]" href={`/admin/clinics/${clinic.id}`}>
                            {clinic.name}
                          </Link>
                          <div className="mt-1 font-mono text-xs text-[var(--muted)]">
                            amo: {clinic.amoDealId ?? "не задано"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone="info">{clinicStatuses[clinic.status] ?? clinic.status}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-28"><ProgressBar value={progress} /></div>
                            <span className="font-medium">{accepted}/{clinic.modules.length}</span>
                          </div>
                          {waiting ? <div className="mt-1 text-xs text-[var(--primary)]">{waiting} на проверке</div> : null}
                          {sla.active ? (
                            <div className={`mt-1 text-xs ${sla.overdue ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                              SLA: {sla.overdue ? "просрочен" : `${sla.remainingBusinessDays} раб. дн.`}
                            </div>
                          ) : null}
                        </td>
                        <td className="hidden px-5 py-4 sm:table-cell">{clinic.users.length}</td>
                        <td className="hidden px-5 py-4 text-[var(--muted)] sm:table-cell">{formatDate(clinic.createdAt)}</td>
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
          </Panel>

          <Panel title="События" action={<TextLink href="/admin/events">Все события</TextLink>}>
            <div className="divide-y divide-[var(--border)]">
              {events.slice(0, 8).map((event) => (
                <div key={event.id} className="p-4 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-xs text-[var(--muted)]">#{event.id} {event.provider}</div>
                    <Badge tone={eventStatusTone[event.status]}>{event.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm">{event.externalId ?? event.eventType ?? "event"}</div>
                  {event.errorMessage ? <div className="mt-1 text-xs text-[var(--danger)]">{event.errorMessage}</div> : null}
                  <div className="mt-2 text-xs text-[var(--muted)]">{formatDate(event.createdAt)}</div>
                </div>
              ))}
              {events.length === 0 ? <EmptyState>Событий пока нет.</EmptyState> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Очередь менеджера">
          <div className="divide-y divide-[var(--border)]">
            {reviewItems.map(({ clinic, module }) => (
              <div key={`${clinic.id}-${module.id}`} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Link className="text-sm text-[var(--primary)]" href={`/admin/clinics/${clinic.id}`}>
                    {clinic.name}
                  </Link>
                  <div className="mt-1 font-semibold">{module.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={moduleStatusTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                    {isReviewOver24h(module) ? <Badge tone="danger">Общая информация &gt; 24ч</Badge> : null}
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
                    <button className="h-10 rounded-md bg-[var(--success)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95" type="submit">
                      Принять
                    </button>
                  </form>
                  <form action={requestRevisionAction} className="flex gap-2">
                    <input name="moduleId" type="hidden" value={module.id} />
                    <input name="clinicId" type="hidden" value={clinic.id} />
                    <input
                      className="h-10 w-56 rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)]"
                      name="comment"
                      placeholder="Комментарий"
                    />
                    <button className="h-10 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50" type="submit">
                      Правки
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {reviewItems.length === 0 ? <EmptyState>Очередь пуста. Новые файлы появятся здесь после загрузки клиентом.</EmptyState> : null}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
