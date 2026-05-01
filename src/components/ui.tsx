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
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 sm:py-8 lg:px-8 animate-fade-in">
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
    <header className="mb-6 rounded-xl glass-card px-5 py-5 sm:px-6 animate-slide-up stagger-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">{eyebrow}</div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
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
    <section className={`overflow-hidden rounded-xl glass-card animate-slide-up stagger-2 ${className}`}>
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 bg-slate-50/30">
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
    <div className="rounded-xl glass-card p-5 transition-all duration-300 hover:-translate-y-1 animate-slide-up stagger-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full shadow-sm ${tone === "danger" ? "bg-[var(--danger)] shadow-[var(--danger-bg)]" : tone === "warning" ? "bg-[var(--warning)] shadow-[var(--warning-bg)]" : tone === "success" ? "bg-[var(--success)] shadow-[var(--success-bg)]" : tone === "info" ? "bg-[var(--primary)] shadow-[var(--info-bg)]" : "bg-slate-300"}`} />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {hint ? <div className="mt-2 text-xs font-medium leading-5 text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)] shadow-inner">
      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-all duration-700 ease-out" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm leading-6 text-[var(--muted)]">{children}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm leading-6 ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}

export function TextLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]" href={href}>
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
          ? "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] active:scale-95"
          : "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg glass px-5 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-white/50 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] active:scale-95"
      }
      href={href}
    >
      {children}
    </Link>
  );
}
