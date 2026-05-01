import { redirect } from "next/navigation";
import { clinicStatuses, moduleStatuses, type ModuleStatus } from "@/lib/domain";
import { getPortalClinic } from "@/lib/db/clinics";
import { ModuleFileUploadForm } from "@/app/portal/module-file-upload-form";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, PageShell, Panel, ProgressBar, StatCard } from "@/components/ui";

const moduleTone: Record<ModuleStatus, "neutral" | "info" | "success" | "warning"> = {
  collection: "neutral",
  review: "info",
  needs_revision: "warning",
  accepted: "success",
};

export default async function PortalPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/portal");
  }

  const clinic = await getPortalClinic(session.clinicId ?? 1);
  const acceptedCount = clinic.modules.filter((module) => module.status === "accepted").length;
  const reviewCount = clinic.modules.filter((module) => module.status === "review").length;
  const revisionCount = clinic.modules.filter((module) => module.status === "needs_revision").length;
  const uploadedCount = clinic.modules.filter((module) => module.currentFileUrl).length;
  const progress = clinic.modules.length > 0 ? Math.round((acceptedCount / clinic.modules.length) * 100) : 0;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Кабинет клиники</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{clinic.name}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Следите за статусами модулей, загружайте актуальные файлы и отвечайте на комментарии менеджера.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.role === "admin" || session.role === "manager" ? <ButtonLink href="/admin">Админка</ButtonLink> : null}
              <LogoutButton />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <ProgressBar value={progress} />
            <div className="text-sm font-semibold text-[var(--muted)]">{progress}% принято</div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard hint={clinicStatuses[clinic.status] ?? clinic.status} label="Статус клиники" tone="info" value={clinic.status === "completed" ? "Готово" : "В работе"} />
          <StatCard hint={`${acceptedCount} из ${clinic.modules.length}`} label="Принято" tone="success" value={acceptedCount} />
          <StatCard hint={revisionCount ? "Нужна реакция" : "Без срочных правок"} label="Правки" tone={revisionCount ? "warning" : "neutral"} value={revisionCount} />
          <StatCard hint={`${uploadedCount} модулей с файлами`} label="Файлы" tone="neutral" value={uploadedCount} />
        </div>

        <Panel title="Модули внедрения">
          <div className="grid gap-3 border-b border-[var(--border)] bg-slate-50 p-5 md:grid-cols-4">
            {clinic.modules.map((module, index) => (
              <div key={module.id} className="rounded-md border border-[var(--border)] bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[var(--muted)]">Шаг {index + 1}</div>
                  <Badge tone={moduleTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                </div>
                <div className="mt-2 truncate text-sm font-semibold">{module.name}</div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-[var(--border)]">
            {clinic.modules.map((module) => (
              <article key={module.id} className="p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{module.name}</h2>
                      <Badge tone={moduleTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                    </div>
                    {module.managerComment ? (
                      <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--warning)]">Комментарий менеджера</div>
                        <p className="mt-1 text-sm leading-6 text-[var(--warning)]">{module.managerComment}</p>
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {module.status === "accepted"
                        ? "Файл принят менеджером. Новая версия не требуется."
                        : module.currentFileUrl
                          ? "Файл загружен. Можно заменить актуальной версией."
                          : "Загрузите файл для проверки менеджером."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  {module.status === "accepted" ? (
                    <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-[var(--success)]">
                      Модуль принят. Повторная загрузка заблокирована.
                    </div>
                  ) : (
                    <ModuleFileUploadForm moduleId={module.id} moduleName={module.name} />
                  )}
                  {module.currentFileUrl ? (
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
                      href={module.currentFileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Открыть файл
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
            {clinic.modules.length === 0 ? <div className="p-8 text-center text-sm text-[var(--muted)]">Модули пока не настроены.</div> : null}
          </div>
        </Panel>

        {reviewCount > 0 ? (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--primary)]">
            {reviewCount} модулей сейчас на проверке у менеджера.
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
