"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { t } = useLang();

  const navItems = [
    { href: "/gantt", label: t("nav.gantt"), icon: "📊", desc: t("nav.ganttDesc") },
    { href: "/wbs", label: t("nav.wbs"), icon: "🌳", desc: t("nav.wbsDesc") },
    { href: "/resources", label: t("nav.resources"), icon: "👥", desc: t("nav.resourcesDesc") },
    { href: "/evm", label: t("nav.evm"), icon: "📈", desc: t("nav.evmDesc") },
    { href: "/mta", label: t("nav.mta"), icon: "📉", desc: t("nav.mtaDesc") },
  ];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              PM Extension Service
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 mt-2">
              {t("nav.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group block p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-sky-400 dark:hover:border-sky-500 hover:-translate-y-0.5 transition-all"
            >
              <span className="text-3xl">{item.icon}</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-3">
                {item.label}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {item.desc}
              </p>
            </Link>
          ))}
        </div>

        {/* API Info */}
        <div className="mt-10 p-5 bg-sky-50 dark:bg-sky-900/30 rounded-xl border border-sky-200 dark:border-sky-800">
          <p className="text-sm text-sky-800 dark:text-sky-300">
            <strong className="font-bold">{t("nav.apiDocs")}</strong>{" "}
            <a
              href="http://localhost:8080/docs"
              className="underline underline-offset-2 hover:text-sky-600 dark:hover:text-sky-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              http://localhost:8080/docs
            </a>
          </p>
        </div>

        {/* Status */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Plane v1.3.1 · PM Extension v0.1.0</span>
        </div>
      </div>
    </main>
  );
}
