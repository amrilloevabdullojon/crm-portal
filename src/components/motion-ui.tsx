"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function MotionPageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6 sm:py-8 lg:px-8"
    >
      <section className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</section>
    </motion.main>
  );
}

export function MotionPanel({
  children,
  className = "",
  title,
  action,
  delay = 0,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={`overflow-hidden rounded-xl glass-card ${className}`}
    >
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 bg-slate-50/30 dark:bg-slate-900/30">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <div />}
          {action}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}
