import { redirect } from "next/navigation";
import { clinicStatuses, moduleStatuses, type ModuleStatus, type PortalModule } from "@/lib/domain";
import { listPortalActivityLog, type ActivityLogRow } from "@/lib/db/activity";
import { getPortalClinic } from "@/lib/db/clinics";
import { ModuleFileUploadForm } from "@/app/portal/module-file-upload-form";
import { getSession } from "@/lib/auth/session";
import { getSlaSummary } from "@/lib/sla";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, Notice, PageShell, Panel, ProgressBar, StatCard } from "@/components/ui";

const moduleTone: Record<ModuleStatus, "neutral" | "info" | "success" | "warning"> = {
  collection: "neutral",
  review: "info",
  needs_revision: "warning",
  accepted: "success",
};

const moduleAccentClass: Record<ModuleStatus, string> = {
  collection: "border-l-slate-300",
  review: "border-l-[var(--primary)]",
  needs_revision: "border-l-[var(--warning)]",
  accepted: "border-l-[var(--success)]",
};

const moduleSurfaceClass: Record<ModuleStatus, string> = {
  collection: "bg-white",
  review: "bg-blue-50/45",
  needs_revision: "bg-amber-50/60",
  accepted: "bg-emerald-50/50",
};

type ModuleFilter = "all" | "actions" | "review" | "accepted";

const moduleFilters: Array<{ label: string; value: ModuleFilter }> = [
  { label: "Все", value: "all" },
  { label: "Нужны действия", value: "actions" },
  { label: "На проверке", value: "review" },
  { label: "Принято", value: "accepted" },
];

function parseModuleFilter(value: string | string[] | undefined): ModuleFilter {
  const filter = typeof value === "string" ? value : "all";
  return moduleFilters.some((item) => item.value === filter) ? (filter as ModuleFilter) : "all";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "размер не указан";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const absValue = Math.abs(value);
  const lastTwo = absValue % 100;
  const last = absValue % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function getCurrentFile(module: PortalModule) {
  return module.currentFile ?? module.files?.find((file) => file.isCurrent) ?? module.files?.[0];
}

function getModuleHint(module: PortalModule) {
  if (module.status === "accepted") return "Файл принят. Новая версия не требуется.";
  if (module.status === "needs_revision") return "Исправьте файл по комментарию и загрузите новую версию.";
  if (module.status === "review") return "Файл на проверке. Если нашли ошибку, можно заменить новой версией.";
  if (getCurrentFile(module)) return "Файл загружен. Можно заменить актуальной версией.";
  return "Загрузите файл, чтобы менеджер смог начать проверку.";
}

function getActionTitle(module: PortalModule) {
  if (module.status === "needs_revision") return "Нужны правки";
  if (module.status === "collection" && !getCurrentFile(module)) return "Ожидаем файл";
  if (module.status === "review") return "На проверке";
  return "Готово";
}

function needsClientAction(module: PortalModule) {
  return module.status === "needs_revision" || (module.status === "collection" && !getCurrentFile(module));
}

function getPortalNextAction({
  progress,
  reviewCount,
  uploadNeededCount,
}: {
  progress: number;
  reviewCount: number;
  uploadNeededCount: number;
}) {
  if (uploadNeededCount > 0) {
    return {
      title: `${uploadNeededCount} ${pluralRu(uploadNeededCount, "модуль требует", "модуля требуют", "модулей требуют")} действия`,
      description: "Откройте первый блок из списка и загрузите актуальную версию файла.",
      tone: "warning" as const,
    };
  }

  if (reviewCount > 0) {
    return {
      title: "Файлы на проверке",
      description: "Сейчас очередь на стороне DMED. Статус обновится после проверки менеджером.",
      tone: "info" as const,
    };
  }

  if (progress === 100) {
    return {
      title: "Сбор завершен",
      description: "Все блоки приняты. Актуальные файлы доступны в папке клиники.",
      tone: "success" as const,
    };
  }

  return {
    title: "Нет срочных действий",
    description: "Проверьте список модулей ниже и загрузите файлы, когда они будут готовы.",
    tone: "neutral" as const,
  };
}

function matchesModuleFilter(module: PortalModule, filter: ModuleFilter) {
  if (filter === "actions") return needsClientAction(module);
  if (filter === "review") return module.status === "review";
  if (filter === "accepted") return module.status === "accepted";
  return true;
}

function detailText(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function getActivityView(activity: ActivityLogRow): {
  title: string;
  description: string;
  source: string;
  tone: "info" | "success" | "warning";
} {
  const moduleName = activity.moduleName ?? "Модуль";
  const fileName = detailText(activity.details, "fileName");

  if (activity.action === "module.file_uploaded") {
    return {
      title: "Файл загружен",
      description: fileName ? `${moduleName}: ${fileName}` : `${moduleName}: файл отправлен на проверку.`,
      source: "Клиент",
      tone: "info",
    };
  }

  if (activity.action === "module.accepted") {
    return {
      title: "Файл принят",
      description: fileName ? `${moduleName}: ${fileName}` : `${moduleName}: данные приняты.`,
      source: "DMED",
      tone: "success",
    };
  }

  return {
    title: "Нужны правки",
    description: detailText(activity.details, "comment") || `${moduleName}: менеджер оставил комментарий.`,
    source: "DMED",
    tone: "warning",
  };
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/portal");
  }

  const clinicId = session.clinicId ?? 1;
  const [clinic, activityLog, params] = await Promise.all([
    getPortalClinic(clinicId),
    listPortalActivityLog({ clinicId, limit: 12 }),
    searchParams,
  ]);
  const moduleFilter = parseModuleFilter(params.filter);
  const acceptedCount = clinic.modules.filter((module) => module.status === "accepted").length;
  const reviewCount = clinic.modules.filter((module) => module.status === "review").length;
  const revisionCount = clinic.modules.filter((module) => module.status === "needs_revision").length;
  const uploadNeededCount = clinic.modules.filter((module) => needsClientAction(module)).length;
  const uploadedCount = clinic.modules.filter((module) => getCurrentFile(module)).length;
  const progress = clinic.modules.length > 0 ? Math.round((acceptedCount / clinic.modules.length) * 100) : 0;
  const sla = getSlaSummary(clinic.slaStartedAt);
  const actionModules = clinic.modules
    .filter((module) => needsClientAction(module))
    .slice(0, 4);
  const visibleModules = clinic.modules.filter((module) => matchesModuleFilter(module, moduleFilter));
  const portalNextAction = getPortalNextAction({ progress, reviewCount, uploadNeededCount });

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <header className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Кабинет клиники</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{clinic.name}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Следите за статусами модулей, загружайте актуальные файлы и отвечайте на комментарии менеджера.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="info">{clinicStatuses[clinic.status] ?? clinic.status}</Badge>
                <Badge tone={portalNextAction.tone}>{portalNextAction.title}</Badge>
                {sla.active ? <Badge tone={sla.overdue ? "danger" : "info"}>SLA: {sla.overdue ? "просрочен" : `${sla.remainingBusinessDays} раб. дн.`}</Badge> : null}
              </div>
            </div>
            <aside className={`border-l-4 px-4 py-1 ${portalNextAction.tone === "warning" ? "border-l-[var(--warning)]" : portalNextAction.tone === "success" ? "border-l-[var(--success)]" : portalNextAction.tone === "info" ? "border-l-[var(--primary)]" : "border-l-slate-300"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Следующий шаг</div>
              <div className="mt-2 text-lg font-semibold">{portalNextAction.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{portalNextAction.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {actionModules[0] ? (
                  <a
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)]"
                    href={`#module-${actionModules[0].id}`}
                  >
                    Открыть первый блок
                  </a>
                ) : null}
                {clinic.driveFolderUrl ? (
                  <a
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
                    href={clinic.driveFolderUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Папка файлов
                  </a>
                ) : null}
              </div>
            </aside>
          </div>
          <div className="border-t border-[var(--border)] bg-slate-50/70 px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Прогресс принятия</span>
              <span className="font-semibold text-[var(--muted)]">{acceptedCount}/{clinic.modules.length} модулей</span>
            </div>
            <ProgressBar value={progress} />
            <div className="mt-2 text-xs font-semibold text-[var(--muted)]">{progress}% принято</div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-5 py-4">
            {session.role === "admin" || session.role === "manager" ? <ButtonLink href="/admin">Админка</ButtonLink> : null}
            <LogoutButton />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-5">
          <StatCard hint={clinicStatuses[clinic.status] ?? clinic.status} label="Статус клиники" tone="info" value={clinic.status === "completed" ? "Готово" : "В работе"} />
          <StatCard hint={`${acceptedCount} из ${clinic.modules.length}`} label="Принято" tone="success" value={acceptedCount} />
          <StatCard hint={revisionCount ? "Нужна реакция" : "Без срочных правок"} label="Правки" tone={revisionCount ? "warning" : "neutral"} value={revisionCount} />
          <StatCard hint={uploadNeededCount ? "Нужно загрузить" : `${uploadedCount} ${pluralRu(uploadedCount, "модуль с файлом", "модуля с файлами", "модулей с файлами")}`} label="Ожидаем файлы" tone={uploadNeededCount ? "warning" : "neutral"} value={uploadNeededCount} />
          <StatCard
            hint={sla.active && sla.dueAt ? `До ${formatDate(sla.dueAt)}` : "Запустится после принятия общей информации"}
            label="SLA"
            tone={sla.overdue ? "danger" : sla.active ? "info" : "neutral"}
            value={sla.active ? (sla.overdue ? "Просрочен" : `${sla.remainingBusinessDays} дн.`) : "Не запущен"}
          />
        </div>

        {revisionCount ? (
          <Notice tone="warning">
            Есть модули с правками. Откройте комментарий менеджера, загрузите новую версию, и статус автоматически вернется на проверку.
          </Notice>
        ) : null}
        {!revisionCount && reviewCount ? (
          <Notice tone="info">
            {reviewCount} {pluralRu(reviewCount, "модуль", "модуля", "модулей")} сейчас на проверке. Когда менеджер примет файл или оставит комментарий, статус обновится здесь.
          </Notice>
        ) : null}
        {progress === 100 ? <Notice tone="success">Все модули приняты. Повторная загрузка заблокирована для принятых блоков.</Notice> : null}

        <Panel title="Что сейчас важно">
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {actionModules.map((module) => (
              <div key={module.id} className={`rounded-md border border-l-4 border-[var(--border)] ${moduleAccentClass[module.status]} bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{getActionTitle(module)}</div>
                  <Badge tone={moduleTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                </div>
                <div className="mt-3 text-base font-semibold">{module.name}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{getModuleHint(module)}</p>
                <a className="mt-3 inline-flex text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]" href={`#module-${module.id}`}>
                  Открыть модуль
                </a>
              </div>
            ))}
            {actionModules.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-4">
                <EmptyState>
                  {reviewCount ? "С вашей стороны срочных действий нет. Файлы находятся на проверке." : "Сейчас нет срочных действий по загрузке файлов."}
                </EmptyState>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Модули внедрения">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--muted)]">
              Показано {visibleModules.length} из {clinic.modules.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {moduleFilters.map((filter) => (
                <a
                  key={filter.value}
                  className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
                    moduleFilter === filter.value
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "border border-[var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  href={filter.value === "all" ? "/portal#modules" : `/portal?filter=${filter.value}#modules`}
                >
                  {filter.label}
                </a>
              ))}
            </div>
          </div>
          <div className="grid gap-3 border-b border-[var(--border)] bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {clinic.modules.map((module, index) => (
              <a key={module.id} className={`rounded-md border border-l-4 border-[var(--border)] ${moduleAccentClass[module.status]} bg-white px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-sm`} href={`#module-${module.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[var(--muted)]">Шаг {index + 1}</div>
                  <Badge tone={moduleTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                </div>
                <div className="mt-2 truncate text-sm font-semibold">{module.name}</div>
              </a>
            ))}
          </div>
          <div id="modules" className="scroll-mt-4 divide-y divide-[var(--border)]">
            {visibleModules.map((module) => {
              const currentFile = getCurrentFile(module);
              const files = module.files ?? [];

              return (
                <article key={module.id} id={`module-${module.id}`} className={`scroll-mt-6 border-l-4 ${moduleAccentClass[module.status]} ${moduleSurfaceClass[module.status]} p-5`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{module.name}</h2>
                        <Badge tone={moduleTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                        {files.length ? <span className="text-xs font-semibold text-[var(--muted)]">Версий: {files.length}</span> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{getModuleHint(module)}</p>
                      {module.managerComment ? (
                        <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--warning)]">Комментарий менеджера</div>
                          <p className="mt-1 text-sm leading-6 text-[var(--warning)]">{module.managerComment}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-[var(--border)] bg-white/85 px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Состояние</div>
                      <div className="mt-2 text-sm font-semibold">{getActionTitle(module)}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        {files.length ? `Версий: ${files.length}` : "Файл еще не загружен"}
                      </p>
                    </div>
                  </div>

                  {currentFile ? (
                    <div className="mt-4 rounded-md border border-[var(--border)] bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Текущий файл</div>
                          <a className="mt-1 block truncate text-sm font-semibold text-[var(--primary)]" href={currentFile.fileUrl} rel="noreferrer" target="_blank">
                            {currentFile.fileName}
                          </a>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Загружен: {formatDate(currentFile.createdAt)} · {formatFileSize(currentFile.fileSizeBytes)}
                          </div>
                        </div>
                        <a
                          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
                          href={currentFile.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Открыть файл
                        </a>
                      </div>
                      {files.length > 1 ? (
                        <div className="mt-4 border-t border-[var(--border)] pt-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Последние версии</div>
                          <div className="mt-2 grid gap-2">
                            {files.slice(0, 3).map((file) => (
                              <a key={`${module.id}-${file.id ?? file.fileName}`} className="flex min-w-0 items-center justify-between gap-3 text-xs text-[var(--muted)] hover:text-[var(--primary)]" href={file.fileUrl} rel="noreferrer" target="_blank">
                                <span className="truncate">{file.fileName}</span>
                                <span className="shrink-0">{formatDate(file.createdAt)}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {module.status === "accepted" ? (
                      <div className="rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[var(--success)]">
                        Принято. Повторная загрузка заблокирована, чтобы не заменить проверенную версию.
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-[var(--border)] bg-white/80 p-4">
                        <div className="mb-3">
                          <div className="text-sm font-semibold">Загрузить новую версию</div>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            После отправки блок перейдет на проверку, а старый комментарий менеджера скроется.
                          </p>
                        </div>
                        <ModuleFileUploadForm moduleId={module.id} moduleName={module.name} />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {clinic.modules.length === 0 ? <div className="p-8 text-center text-sm text-[var(--muted)]">Модули пока не настроены.</div> : null}
            {clinic.modules.length > 0 && visibleModules.length === 0 ? <EmptyState>По этому фильтру модулей нет.</EmptyState> : null}
          </div>
        </Panel>

        <Panel title="История действий">
          <div>
            {activityLog.map((activity, index) => {
              const view = getActivityView(activity);

              return (
                <div key={activity.id} className="relative grid gap-3 px-5 py-5 pl-12 sm:grid-cols-[1fr_auto] sm:items-start">
                  {index < activityLog.length - 1 ? <span className="absolute bottom-0 left-[25px] top-9 w-px bg-[var(--border)]" /> : null}
                  <span
                    className={`absolute left-5 top-6 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                      view.tone === "success"
                        ? "bg-[var(--success)]"
                        : view.tone === "warning"
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--primary)]"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{view.title}</div>
                      {activity.moduleName ? <Badge tone={view.tone}>{activity.moduleName}</Badge> : null}
                      <Badge tone="neutral">{view.source}</Badge>
                    </div>
                    <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">{view.description}</p>
                  </div>
                  <time className="text-xs font-semibold text-[var(--muted)] sm:text-right" dateTime={activity.createdAt}>
                    {formatDate(activity.createdAt)}
                  </time>
                </div>
              );
            })}
            {activityLog.length === 0 ? <EmptyState>История появится после первой загрузки, проверки или комментария по файлу.</EmptyState> : null}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
