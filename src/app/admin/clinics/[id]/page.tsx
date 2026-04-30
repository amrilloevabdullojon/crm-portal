import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { clinicStatuses, moduleStatuses, type ModuleStatus } from "@/lib/domain";
import { getAdminClinic } from "@/lib/db/admin";
import { acceptModuleAction, requestRevisionAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";

const moduleStatusTone: Record<ModuleStatus, string> = {
  collection: "bg-[var(--surface-muted)] text-[var(--muted)]",
  review: "bg-blue-50 text-[var(--primary)]",
  needs_revision: "bg-amber-50 text-[var(--warning)]",
  accepted: "bg-emerald-50 text-[var(--success)]",
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

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/admin">
          Назад в админку
        </Link>

        <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{clinic.name}</h1>
              <div className="mt-2 text-sm text-[var(--muted)]">
                {clinicStatuses[clinic.status] ?? clinic.status} · создана {formatDate(clinic.createdAt)}
              </div>
              <div className="mt-2 font-mono text-xs text-[var(--muted)]">amo deal: {clinic.amoDealId ?? "не задано"}</div>
            </div>
            {clinic.driveFolderUrl ? (
              <a
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
                href={clinic.driveFolderUrl}
                rel="noreferrer"
                target="_blank"
              >
                Папка Drive
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-semibold">Контакты</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {clinic.users.map((user) => (
                <div key={user.userId} className="p-5">
                  <div className="font-semibold">{user.name}</div>
                  <div className="mt-1 font-mono text-sm text-[var(--muted)]">{user.phone}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="bg-[var(--surface-muted)] text-[var(--muted)]">{user.role}</Badge>
                    <Badge className={user.telegramLinked ? "bg-emerald-50 text-[var(--success)]" : "bg-amber-50 text-[var(--warning)]"}>
                      {user.telegramLinked ? "Telegram привязан" : "Telegram не привязан"}
                    </Badge>
                  </div>
                </div>
              ))}
              {clinic.users.length === 0 ? <div className="p-5 text-sm text-[var(--muted)]">Контактов пока нет.</div> : null}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-semibold">Модули и файлы</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {clinic.modules.map((module) => (
                <div key={module.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold">{module.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={moduleStatusTone[module.status]}>{moduleStatuses[module.status]}</Badge>
                        {module.managerComment ? (
                          <span className="text-sm text-[var(--warning)]">{module.managerComment}</span>
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

                  <div className="mt-4">
                    {module.files.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="text-[var(--muted)]">
                            <tr>
                              <th className="py-2 pr-4 font-medium">Файл</th>
                              <th className="py-2 pr-4 font-medium">Версия</th>
                              <th className="py-2 pr-4 font-medium">Дата</th>
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
                                <td className="py-3 pr-4">{file.isCurrent ? "Текущий" : "Старый"}</td>
                                <td className="py-3 pr-4 text-[var(--muted)]">{formatDate(file.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--muted)]">Файлы еще не загружены.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
