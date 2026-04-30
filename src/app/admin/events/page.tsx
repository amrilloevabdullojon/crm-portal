import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { listIntegrationEvents, type IntegrationEventRow } from "@/lib/db/admin";
import { getSession } from "@/lib/auth/session";

const eventStatusTone: Record<IntegrationEventRow["status"], string> = {
  received: "bg-blue-50 text-[var(--primary)]",
  processed: "bg-emerald-50 text-[var(--success)]",
  ignored: "bg-slate-100 text-[var(--muted)]",
  failed: "bg-red-50 text-[var(--danger)]",
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function AdminEventsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin/events");
  }

  if (session.role !== "admin" && session.role !== "manager") {
    redirect("/portal");
  }

  const events = await listIntegrationEvents(80);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-7xl">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/admin">
          Назад в админку
        </Link>
        <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] p-5">
            <h1 className="text-2xl font-semibold">События интеграций</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Последние webhook и системные события amoCRM, Telegram и Drive.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">External ID</th>
                  <th className="px-5 py-3 font-medium">Error</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">#{event.id}</td>
                    <td className="px-5 py-4">{event.provider}</td>
                    <td className="px-5 py-4">
                      <Badge className={eventStatusTone[event.status]}>{event.status}</Badge>
                    </td>
                    <td className="max-w-[280px] truncate px-5 py-4 font-mono text-xs">{event.externalId ?? event.eventType ?? "event"}</td>
                    <td className="max-w-[360px] px-5 py-4 text-[var(--danger)]">
                      {event.errorMessage ? <span className="line-clamp-2">{event.errorMessage}</span> : "—"}
                    </td>
                    <td className="px-5 py-4 text-[var(--muted)]">{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
                {events.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-[var(--muted)]" colSpan={6}>
                      Событий пока нет.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
