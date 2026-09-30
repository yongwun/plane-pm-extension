"use client";

import { useState, useEffect, type ReactNode } from "react";
import { I18nContext, dict, type Lang, type I18nContextValue } from "@/lib/i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("pm-lang") as Lang | null;
    if (stored === "en" || stored === "zh") {
      setLang(stored);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("pm-lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang, mounted]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const entry = dict[key];
    if (!entry) return key; // fallback: show key name
    let text = entry[lang] ?? entry.zh ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const toggleLang = () => setLang((l) => (l === "zh" ? "en" : "zh"));

  const value: I18nContextValue = { lang, t, toggleLang };

  if (!mounted) {
    return <div className="min-h-screen bg-white dark:bg-slate-900" />;
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
