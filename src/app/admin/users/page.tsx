import { redirect } from "next/navigation";
import { clinicStatuses, type UserRole } from "@/lib/domain";
import { getSession } from "@/lib/auth/session";
import { listAdminClinics } from "@/lib/db/admin";
import { listAdminUsers } from "@/lib/db/users";
import { LogoutButton } from "@/components/logout-button";
import { Badge, ButtonLink, EmptyState, PageShell, Panel, StatCard, TextLink } from "@/components/ui";
import {
  createUserAction,
  linkUserToClinicAction,
  setUserActiveAction,
  unlinkTelegramAction,
  updateUserRoleAction,
} from "@/app/admin/users/actions";

const roleTone: Record<UserRole, "neutral" | "info" | "success"> = {
  client: "neutral",
  manager: "info",
  admin: "success",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

export default async function AdminUsersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?next=/admin/users");
  }

  if (session.role !== "admin") {
    redirect("/admin");
  }

  const [users, clinics] = await Promise.all([listAdminUsers(), listAdminClinics()]);
  const activeUsers = users.filter((user) => user.isActive).length;
  const linkedTelegram = users.filter((user) => user.telegramLinked).length;
  const managers = users.filter((user) => user.role === "manager" || user.role === "admin").length;

  return (
    <PageShell wide>
      <div className="flex flex-col gap-6">
        <TextLink href="/admin">Назад в админку</TextLink>

        <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Доступы</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Пользователи</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Добавление клиентов и менеджеров, роли, Telegram-привязки и доступы к клиникам.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/events">События</ButtonLink>
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard hint="Всего в базе" label="Пользователи" tone="info" value={users.length} />
          <StatCard hint="Могут входить" label="Активные" tone="success" value={activeUsers} />
          <StatCard hint="manager/admin" label="Команда" tone="info" value={managers} />
          <StatCard hint="Готовы получать коды" label="Telegram" tone={linkedTelegram ? "success" : "warning"} value={linkedTelegram} />
        </div>

        <Panel title="Добавить пользователя">
          <form action={createUserAction} className="grid gap-3 p-5 md:grid-cols-[1fr_0.9fr_0.8fr_0.8fr_0.8fr_auto] md:items-end">
            <label className="block">
              <span className="text-sm font-semibold">Имя</span>
              <input className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]" name="name" placeholder="Имя" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Телефон</span>
              <input className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]" name="phone" placeholder="+998..." required />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Email</span>
              <input className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--primary)]" name="email" placeholder="optional" type="email" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Роль</span>
              <select className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]" name="role" defaultValue="client">
                <option value="client">client</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Клиника</span>
              <select className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]" name="clinicId" defaultValue="">
                <option value="">Без привязки</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)]" type="submit">
              Добавить
            </button>
          </form>
        </Panel>

        <Panel title="Список пользователей">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm sm:min-w-[1120px]">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Пользователь</th>
                  <th className="px-5 py-3 font-medium">Роль</th>
                  <th className="px-5 py-3 font-medium">Telegram</th>
                  <th className="px-5 py-3 font-medium">Клиники</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Создан</th>
                  <th className="px-5 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => (
                  <tr key={user.id} className={!user.isActive ? "bg-slate-50 text-[var(--muted)]" : "transition hover:bg-slate-50"}>
                    <td className="px-5 py-4">
                      <div className="font-semibold">{user.name}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--muted)]">{user.phone}</div>
                      {user.email ? <div className="mt-1 text-xs text-[var(--muted)]">{user.email}</div> : null}
                    </td>
                    <td className="px-5 py-4">
                      <form action={updateUserRoleAction} className="flex gap-2">
                        <input name="userId" type="hidden" value={user.id} />
                        <select className="h-9 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]" name="role" defaultValue={user.role}>
                          <option value="client">client</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                        <button className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-semibold hover:bg-slate-50" type="submit">
                          OK
                        </button>
                      </form>
                      <div className="mt-2">
                        <Badge tone={roleTone[user.role]}>{user.role}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        <Badge tone={user.telegramLinked ? "success" : "warning"}>{user.telegramLinked ? "Привязан" : "Не привязан"}</Badge>
                        {user.telegramLinked ? (
                          <form action={unlinkTelegramAction}>
                            <input name="userId" type="hidden" value={user.id} />
                            <button className="text-xs font-semibold text-[var(--danger)]" type="submit">
                              Отвязать
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        {user.clinicLinks.map((link) => (
                          <div key={`${user.id}-${link.clinicId}`} className="rounded-md bg-slate-50 px-2 py-1">
                            <div className="font-medium">{link.clinicName}</div>
                            <div className="text-xs text-[var(--muted)]">{link.clinicRole}</div>
                          </div>
                        ))}
                        <form action={linkUserToClinicAction} className="flex gap-2">
                          <input name="userId" type="hidden" value={user.id} />
                          <input name="clinicRole" type="hidden" value={user.role === "client" ? "member" : user.role} />
                          <select className="h-9 max-w-40 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]" name="clinicId" defaultValue="">
                            <option value="">Привязать</option>
                            {clinics.map((clinic) => (
                              <option key={clinic.id} value={clinic.id}>
                                {clinic.name} · {clinicStatuses[clinic.status] ?? clinic.status}
                              </option>
                            ))}
                          </select>
                          <button className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-semibold hover:bg-slate-50" type="submit">
                            OK
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 text-[var(--muted)] lg:table-cell">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-4">
                      <form action={setUserActiveAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <input name="isActive" type="hidden" value={String(!user.isActive)} />
                        <button className="h-9 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-semibold hover:bg-slate-50" type="submit">
                          {user.isActive ? "Отключить" : "Включить"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-[var(--muted)]" colSpan={6}>
                      <EmptyState>Пользователей пока нет.</EmptyState>
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
