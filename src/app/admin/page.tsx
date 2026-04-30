import { redirect } from "next/navigation";
import { moduleStatuses } from "@/lib/domain";
import { listClinicsForAdmin } from "@/lib/db/clinics";
import { acceptModuleAction, requestRevisionAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const clinics = await listClinicsForAdmin();
  const reviewItems = clinics.flatMap((clinic) =>
    clinic.modules
      .filter((module) => module.status === "review" || module.status === "needs_revision")
      .map((module) => ({ clinic, module })),
  );

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm text-[var(--muted)]">Клиники</div>
            <div className="mt-2 text-3xl font-semibold">{clinics.length}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm text-[var(--muted)]">На проверке</div>
            <div className="mt-2 text-3xl font-semibold">{reviewItems.length}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm text-[var(--muted)]">Хранилище</div>
            <div className="mt-2 text-3xl font-semibold">Drive</div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] p-5">
            <h1 className="text-2xl font-semibold">Очередь менеджера</h1>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {reviewItems.map(({ clinic, module }) => (
              <div key={`${clinic.id}-${module.id}`} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="text-sm text-[var(--muted)]">{clinic.name}</div>
                  <div className="mt-1 font-semibold">{module.name}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">{moduleStatuses[module.status]}</div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <form action={acceptModuleAction}>
                    <input name="moduleId" type="hidden" value={module.id} />
                    <button className="h-10 rounded-md bg-[var(--success)] px-4 text-sm font-semibold text-white" type="submit">
                      Принять
                    </button>
                  </form>
                  <form action={requestRevisionAction} className="flex gap-2">
                    <input name="moduleId" type="hidden" value={module.id} />
                    <input
                      className="h-10 w-48 rounded-md border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]"
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
          </div>
        </div>
      </section>
    </main>
  );
}
