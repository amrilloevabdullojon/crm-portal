import { redirect } from "next/navigation";
import { listIntegrationEvents, type IntegrationEventRow } from "@/lib/db/admin";
import { retryIntegrationEventAction } from "@/app/admin/actions";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, Notice, PageShell, Panel, StatCard, TextLink } from "@/components/ui";

const eventStatusTone: Record<IntegrationEventRow["status"], "neutral" | "info" | "success" | "danger"> = {
  received: "info",
  processed: "success",
  ignored: "neutral",
  failed: "danger",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin/events");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const params = await searchParams;
  const notice = typeof params.notice === "string" ? params.notice : "";
  const error = typeof params.error === "string" ? params.error : "";
  const events = await listIntegrationEvents(80);
  const failed = events.filter((event) => event.status === "failed").length;
  const processed = events.filter((event) => event.status === "processed").length;
  const ignored = events.filter((event) => event.status === "ignored").length;

  return (
    <PageShell wide>
      <div className="flex flex-col gap-6">
        <TextLink href="/admin">Назад в админку</TextLink>

        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Мониторинг</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">События интеграций</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Последние webhook и системные события amoCRM, Telegram и Google Drive.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin">Админка</ButtonLink>
              <LogoutButton />
            </div>
          </div>
        </header>

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard hint="Последние 80 записей" label="Всего событий" tone="info" value={events.length} />
          <StatCard hint="Успешно обработаны" label="Processed" tone="success" value={processed} />
          <StatCard hint="Не требовали действий" label="Ignored" tone="neutral" value={ignored} />
          <StatCard hint="Требуют внимания" label="Failed" tone={failed ? "danger" : "neutral"} value={failed} />
        </div>

        <Panel title="Журнал событий">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm sm:min-w-[920px]">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Provider</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">External ID</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Error</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Created</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {events.map((event) => (
                  <tr key={event.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">#{event.id}</td>
                    <td className="hidden px-5 py-4 sm:table-cell">{event.provider}</td>
                    <td className="px-5 py-4">
                      <Badge tone={eventStatusTone[event.status]}>{event.status}</Badge>
                    </td>
                    <td className="max-w-[280px] break-all px-5 py-4 font-mono text-xs">{event.externalId ?? event.eventType ?? "event"}</td>
                    <td className="hidden max-w-[360px] px-5 py-4 text-[var(--danger)] md:table-cell">
                      {event.errorMessage ? <span className="line-clamp-2">{event.errorMessage}</span> : "—"}
                    </td>
                    <td className="hidden px-5 py-4 text-[var(--muted)] sm:table-cell">{formatDate(event.createdAt)}</td>
                    <td className="px-5 py-4">
                      {(event.provider === "amo" || event.provider === "slack") && event.status !== "processed" ? (
                        <form action={retryIntegrationEventAction}>
                          <input name="eventId" type="hidden" value={event.id} />
                          <button className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-semibold transition hover:bg-slate-50" type="submit">
                            Повторить
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {events.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-[var(--muted)]" colSpan={7}>
                      <EmptyState>Событий пока нет.</EmptyState>
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
