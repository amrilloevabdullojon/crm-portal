import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAmoStatusSettings } from "@/lib/db/settings";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, PageShell, Panel, StatCard, TextLink } from "@/components/ui";
import { updateAmoStatusSettingsAction } from "@/app/admin/settings/actions";

function formatDate(value?: string) {
  if (!value) return "не менялись";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function AdminSettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin/settings");
  }

  if (session.role !== "admin") {
    redirect("/admin");
  }

  const amoSettings = await getAmoStatusSettings();
  const statusText = amoSettings.targetStatusIds.join(", ");

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <TextLink href="/admin">Назад в админку</TextLink>

        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Настройки</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Интеграции</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Управление параметрами интеграций без изменения Vercel env и redeploy.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/users">Пользователи</ButtonLink>
              <ButtonLink href="/admin/events">События</ButtonLink>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard hint="Активные этапы сбора" label="amoCRM статусы" tone="info" value={amoSettings.targetStatusIds.length} />
          <StatCard hint={amoSettings.source === "db" ? "из базы" : "fallback из env"} label="Источник" tone={amoSettings.source === "db" ? "success" : "warning"} value={amoSettings.source.toUpperCase()} />
          <StatCard hint="Asia/Tashkent" label="Обновлено" tone="neutral" value={formatDate(amoSettings.updatedAt)} />
        </div>

        <Panel title="amoCRM: этапы запуска сбора данных">
          <form action={updateAmoStatusSettingsAction} className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              {amoSettings.targetStatusIds.map((statusId) => (
                <Badge key={statusId} tone="info">{statusId}</Badge>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-semibold">Status IDs</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-[var(--primary)]"
                defaultValue={statusText}
                name="targetStatusIds"
                placeholder="84088646, 85285282"
                required
              />
            </label>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Можно вводить через запятую, пробел или новую строку. Webhook amoCRM будет создавать/обновлять кабинеты только при смене этапа сделки на один из этих статусов. Событие создания сделки игнорируется.
            </p>
            <button className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)]" type="submit">
              Сохранить
            </button>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
