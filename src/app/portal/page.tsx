import { redirect } from "next/navigation";
import { moduleStatuses } from "@/lib/domain";
import { getPortalClinic } from "@/lib/db/clinics";
import { ModuleFileUploadForm } from "@/app/portal/module-file-upload-form";
import { getSession } from "@/lib/auth/session";

export default async function PortalPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/portal");
  }

  const clinic = await getPortalClinic(session.clinicId ?? 1);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="text-sm text-[var(--muted)]">Клиентский портал</div>
          <h1 className="mt-1 text-3xl font-semibold">{clinic.name}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Файлы загружаются в Google Drive, статусы хранятся в Postgres. User #{session.userId}
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          {clinic.modules.map((module) => (
            <article key={module.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{module.name}</h2>
                  {module.managerComment ? (
                    <p className="mt-2 text-sm text-[var(--warning)]">{module.managerComment}</p>
                  ) : null}
                </div>
                <span className="w-fit rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm">
                  {moduleStatuses[module.status]}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <ModuleFileUploadForm moduleId={module.id} moduleName={module.name} />
                {module.currentFileUrl ? (
                  <a className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold" href={module.currentFileUrl}>
                    Открыть файл
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
