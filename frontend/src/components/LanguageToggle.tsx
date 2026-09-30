"use client";

import { useLang } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, toggleLang } = useLang();
  return (
    <button
      onClick={toggleLang}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      <span className={lang === "zh" ? "font-bold text-sky-600 dark:text-sky-400" : "opacity-50"}>中</span>
      <span className="text-slate-400">|</span>
      <span className={lang === "en" ? "font-bold text-sky-600 dark:text-sky-400" : "opacity-50"}>EN</span>
    </button>
  );
}
