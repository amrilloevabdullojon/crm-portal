import { notFound, redirect } from "next/navigation";
import { clinicStatuses, moduleStatuses, type ModuleStatus } from "@/lib/domain";
import { getAdminClinic } from "@/lib/db/admin";
import {
  acceptModuleAction,
  requestRevisionAction,
  sendAccessRequestAction,
  sendSetupRequestAction,
} from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";
import { getSlaSummary } from "@/lib/sla";
import { hasSlackConfig } from "@/lib/slack/client";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, PageShell, Panel, ProgressBar, StatCard, TextLink } from "@/components/ui";

const moduleStatusTone: Record<ModuleStatus, "neutral" | "info" | "success" | "warning"> = {
  collection: "neutral",
  review: "info",
  needs_revision: "warning",
  accepted: "success",
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

export default async function AdminClinicPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const { id } = await params;
  const clinicId = Number(id);

  if (!Number.isFinite(clinicId)) notFound();

  const clinic = await getAdminClinic(clinicId);
  if (!clinic) notFound();
  const acceptedCount = clinic.modules.filter((module) => module.status === "accepted").length;
  const reviewCount = clinic.modules.filter((module) => module.status === "review").length;
  const revisionCount = clinic.modules.filter((module) => module.status === "needs_revision").length;
  const progress = clinic.modules.length > 0 ? Math.round((acceptedCount / clinic.modules.length) * 100) : 0;
  const sla = getSlaSummary(clinic.slaStartedAt);
  const slackConfigured = hasSlackConfig();
  const generalInfoAccepted = clinic.modules.some((module) => isGeneralInfoName(module.name) && module.status === "accepted");
  const allModulesAccepted = clinic.modules.length > 0 && clinic.modules.every((module) => module.status === "accepted");

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <TextLink href="/admin">Назад в админку</TextLink>

        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Карточка клиники</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{clinic.name}</h1>
              <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {clinicStatuses[clinic.status] ?? clinic.status} · создана {formatDate(clinic.createdAt)}
              </div>
              <div className="mt-2 font-mono text-xs text-[var(--muted)]">amo deal: {clinic.amoDealId ?? "не задано"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {clinic.driveFolderUrl ? (
                <a
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
                  href={clinic.driveFolderUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Папка Drive
                </a>
              ) : null}
              <ButtonLink href="/admin/events">События</ButtonLink>
              <LogoutButton />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <ProgressBar value={progress} />
            <div className="text-sm font-semibold text-[var(--muted)]">{progress}% принято</div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-5">
          <StatCard hint="Контакты клиники" label="Пользователи" tone="info" value={clinic.users.length} />
          <StatCard hint={`${acceptedCount} из ${clinic.modules.length}`} label="Принято" tone="success" value={acceptedCount} />
          <StatCard hint="Ожидают менеджера" label="На проверке" tone={reviewCount ? "warning" : "neutral"} value={reviewCount} />
          <StatCard hint="Нужен ответ клиента" label="Правки" tone={revisionCount ? "warning" : "neutral"} value={revisionCount} />
          <StatCard
            hint={sla.active ? (sla.overdue ? "Просрочен" : `${sla.remainingBusinessDays} раб. дн. осталось`) : "Ждет общую информацию"}
            label="SLA"
            tone={sla.overdue ? "danger" : sla.active ? "info" : "neutral"}
            value={sla.active ? "Активен" : "Не запущен"}
          />
        </div>

        <Panel title="Передача админам">
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <form action={sendAccessRequestAction} className="rounded-md border border-[var(--border)] bg-slate-50 p-4">
              <input name="clinicId" type="hidden" value={clinic.id} />
              <div className="font-semibold">Срочная заявка на доступы</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Отправляет админам заявку после принятия блока “Общая информация”.
              </p>
              <button
                className="mt-4 h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!slackConfigured || !generalInfoAccepted}
                type="submit"
              >
                Выдать доступы
              </button>
              {!slackConfigured ? (
                <div className="mt-2 text-xs text-[var(--warning)]">Сначала настройте Slack env на Vercel.</div>
              ) : !generalInfoAccepted ? (
                <div className="mt-2 text-xs text-[var(--warning)]">Сначала примите блок “Общая информация”.</div>
              ) : null}
            </form>

            <form action={sendSetupRequestAction} className="rounded-md border border-[var(--border)] bg-slate-50 p-4">
              <input name="clinicId" type="hidden" value={clinic.id} />
              <div className="font-semibold">Финальная заявка на настройку</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Отправляет в Slack ссылку на “АКТУАЛЬНО”, список файлов и комментарий менеджера.
              </p>
              <textarea
                className="mt-3 min-h-24 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
                name="additionalInfo"
                placeholder="Доп. информация для админов"
              />
              <button
                className="mt-3 h-10 rounded-md bg-[var(--success)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!slackConfigured || !allModulesAccepted}
                type="submit"
              >
                Отправить настройку
              </button>
              {!slackConfigured ? (
                <div className="mt-2 text-xs text-[var(--warning)]">Сначала настройте Slack env на Vercel.</div>
              ) : !allModulesAccepted ? (
                <div className="mt-2 text-xs text-[var(--warning)]">Финальная заявка доступна после принятия всех модулей.</div>
              ) : null}
            </form>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <Panel title="Контакты">
            <div className="divide-y divide-[var(--border)]">
              {clinic.users.map((user) => (
                <div key={user.userId} className="p-5 transition hover:bg-slate-50">
                  <div className="font-semibold">{user.name}</div>
                  <div className="mt-1 font-mono text-sm text-[var(--muted)]">{user.phone}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={user.role === "admin" ? "info" : "neutral"}>{user.role}</Badge>
                    <Badge tone={user.telegramLinked ? "success" : "warning"}>
                      {user.telegramLinked ? "Telegram привязан" : "Telegram не привязан"}
                    </Badge>
                  </div>
                </div>
              ))}
              {clinic.users.length === 0 ? <EmptyState>Контактов пока нет.</EmptyState> : null}
            </div>
          </Panel>

          <Panel title="Модули и файлы">
            <div className="divide-y divide-[var(--border)]">
              {clinic.modules.map((module) => (
                <div key={module.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold">{module.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={moduleStatusTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                        {module.managerComment ? (
                          <span className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1 text-sm text-[var(--warning)]">
                            {module.managerComment}
                          </span>
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

                  <div className="mt-4">
                    {module.files.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-left text-sm sm:min-w-[560px]">
                          <thead className="text-[var(--muted)]">
                            <tr>
                              <th className="py-2 pr-4 font-medium">Файл</th>
                              <th className="py-2 pr-4 font-medium">Версия</th>
                              <th className="hidden py-2 pr-4 font-medium sm:table-cell">Дата</th>
                            </tr>
                          </thead>
                          <tbody>
                            {module.files.map((file) => (
                              <tr key={file.id} className="border-t border-[var(--border)]">
                                <td className="py-3 pr-4">
                                  <a className="font-semibold text-[var(--primary)]" href={file.fileUrl} rel="noreferrer" target="_blank">
                                    {file.fileName}
                                  </a>
                                </td>
                                <td className="py-3 pr-4">
                                  <Badge tone={file.isCurrent ? "success" : "neutral"}>{file.isCurrent ? "Текущий" : "Старый"}</Badge>
                                </td>
                                <td className="hidden py-3 pr-4 text-[var(--muted)] sm:table-cell">{formatDate(file.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-md bg-slate-50 px-3 py-3 text-sm text-[var(--muted)]">Файлы еще не загружены.</div>
                    )}
                  </div>
                </div>
              ))}
              {clinic.modules.length === 0 ? <EmptyState>Модули пока не настроены.</EmptyState> : null}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
