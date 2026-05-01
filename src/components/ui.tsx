import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-blue-100 bg-blue-50 text-[var(--primary)]",
  success: "border-emerald-100 bg-emerald-50 text-[var(--success)]",
  warning: "border-amber-100 bg-amber-50 text-[var(--warning)]",
  danger: "border-red-100 bg-red-50 text-[var(--danger)]",
};

export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--foreground)] sm:px-6 lg:px-8">
      <section className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</section>
    </main>
  );
}

export function TopBar({
  actions,
  eyebrow = "DMED Portal",
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <header className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm ${className}`}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <div />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  tone = "neutral",
  value,
  hint,
}: {
  hint?: string;
  label: string;
  tone?: Tone;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full ${tone === "danger" ? "bg-[var(--danger)]" : tone === "warning" ? "bg-[var(--warning)]" : tone === "success" ? "bg-[var(--success)]" : tone === "info" ? "bg-[var(--primary)]" : "bg-slate-300"}`} />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm leading-6 text-[var(--muted)]">{children}</div>;
}

export function TextLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-dark)]" href={href}>
      {children}
    </Link>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "secondary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      className={
        variant === "primary"
          ? "inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-dark)]"
          : "inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
      }
      href={href}
    >
      {children}
    </Link>
  );
}
