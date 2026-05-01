import Link from "next/link";
import { redirect } from "next/navigation";
import type { ModuleStatus } from "@/lib/domain";
import { listAdminClinics, type AdminClinic } from "@/lib/db/admin";
import { getSession } from "@/lib/auth/session";
import { getSlaSummary } from "@/lib/sla";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, PageShell, Panel, StatCard, TextLink } from "@/components/ui";

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function isGeneralInfoName(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("общ") || normalized.includes("general");
}

function getGeneralInfoReviewAge(clinic: AdminClinic) {
  const clinicModule = clinic.modules.find((item) => isGeneralInfoName(item.name) && item.status === "review");
  const latestFile = clinicModule?.files[0];

  if (!clinicModule || !latestFile) return null;

  const ageMs = Date.now() - new Date(latestFile.createdAt).getTime();
  return {
    module: clinicModule,
    hours: Math.floor(ageMs / 60 / 60 / 1000),
    overdue: ageMs > 24 * 60 * 60 * 1000,
  };
}

function getClinicTone(clinic: AdminClinic): "info" | "success" | "warning" | "danger" | "neutral" {
  const sla = getSlaSummary(clinic.slaStartedAt);
  const generalReview = getGeneralInfoReviewAge(clinic);

  if (sla.overdue) return "danger";
  if (generalReview?.overdue) return "warning";
  if (sla.active) return "info";
  if (clinic.modules.every((module) => module.status === "accepted")) return "success";
  return "neutral";
}

function moduleStatusCount(clinic: AdminClinic, status: ModuleStatus) {
  return clinic.modules.filter((module) => module.status === status).length;
}

export default async function AdminSlaPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin/sla");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const clinics = await listAdminClinics();
  const activeSla = clinics.filter((clinic) => getSlaSummary(clinic.slaStartedAt).active);
  const overdueSla = activeSla.filter((clinic) => getSlaSummary(clinic.slaStartedAt).overdue);
  const generalReviewOverdue = clinics.filter((clinic) => getGeneralInfoReviewAge(clinic)?.overdue);
  const needsRevision = clinics.filter((clinic) => moduleStatusCount(clinic, "needs_revision") > 0);

  return (
    <PageShell wide>
      <div className="flex flex-col gap-6">
        <TextLink href="/admin">Назад в админку</TextLink>

        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SLA контроль</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Сроки и проверка данных</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Отслеживание 5 рабочих дней после принятия общей информации и задержек проверки больше 24 часов.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/events">События</ButtonLink>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard hint="Идет отсчет 5 рабочих дней" label="SLA активны" tone="info" value={activeSla.length} />
          <StatCard hint="Требуют эскалации" label="SLA просрочены" tone={overdueSla.length ? "danger" : "neutral"} value={overdueSla.length} />
          <StatCard hint="Общая информация на проверке > 24ч" label="Проверка > 24ч" tone={generalReviewOverdue.length ? "warning" : "neutral"} value={generalReviewOverdue.length} />
          <StatCard hint="Ожидают клиента" label="Требуют правки" tone={needsRevision.length ? "warning" : "neutral"} value={needsRevision.length} />
        </div>

        <Panel title="Клиники">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm sm:min-w-[920px]">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Клиника</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">SLA</th>
                  <th className="px-5 py-3 font-medium">Общая информация</th>
                  <th className="px-5 py-3 font-medium">Модули</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {clinics.map((clinic) => {
                  const sla = getSlaSummary(clinic.slaStartedAt);
                  const generalReview = getGeneralInfoReviewAge(clinic);

                  return (
                    <tr key={clinic.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <Link className="font-semibold text-[var(--primary)]" href={`/admin/clinics/${clinic.id}`}>
                          {clinic.name}
                        </Link>
                        <div className="mt-1 font-mono text-xs text-[var(--muted)]">amo: {clinic.amoDealId ?? "не задано"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={getClinicTone(clinic)}>
                          {sla.overdue ? "SLA просрочен" : generalReview?.overdue ? "Проверка > 24ч" : sla.active ? "SLA активен" : "Ожидание"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        {sla.active ? (
                          <div>
                            <div className={sla.overdue ? "font-semibold text-[var(--danger)]" : "font-semibold"}>
                              {sla.overdue ? "Просрочен" : `${sla.remainingBusinessDays} раб. дн.`}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">до {formatDate(sla.dueAt)}</div>
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">Не запущен</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {generalReview ? (
                          <div className={generalReview.overdue ? "font-semibold text-[var(--warning)]" : ""}>
                            На проверке {generalReview.hours}ч
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">Нет задержки</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="success">Принято: {moduleStatusCount(clinic, "accepted")}</Badge>
                          <Badge tone="info">Проверка: {moduleStatusCount(clinic, "review")}</Badge>
                          <Badge tone="warning">Правки: {moduleStatusCount(clinic, "needs_revision")}</Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {clinics.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-[var(--muted)]" colSpan={5}>
                      <EmptyState>Клиник пока нет.</EmptyState>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
