"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  projects, gantt, type ProjectExt, type WBSResponse, type WorkitemUpdate,
} from "@/lib/api";
import WBSTree from "@/components/WBSTree";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";

export default function WBSPage() {
  const { t } = useLang();
  const [projectList, setProjectList] = useState<ProjectExt[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [wbsData, setWbsData] = useState<WBSResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    projects.list().then(setProjectList).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) { setWbsData(null); return; }
    setLoading(true);
    setError("");
    gantt.getWBS(selectedProject)
      .then(setWbsData)
      .catch((e) => setError(e.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [selectedProject]);

  const handleSync = async () => {
    try {
      setLoading(true);
      const list = await projects.syncFromPlane();
      setProjectList(list);
      if (selectedProject) {
        await projects.syncWorkitems(selectedProject);
        setWbsData(await gantt.getWBS(selectedProject));
      }
    } catch (e: unknown) {
      setError((e as Error).message || "同步失败");
    } finally {
      setLoading(false);
    }
  };

  const [editable, setEditable] = useState(true);

  const handleSave = async (nodeId: string, data: WorkitemUpdate) => {
    if (!selectedProject) return;
    try {
      await gantt.updateWorkitem(selectedProject, nodeId, data);
      setWbsData(await gantt.getWBS(selectedProject));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ← {t("common.home")}
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("wbs.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">{t("common.selectProject")}</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.plane_project_name || p.plane_project_id}
              </option>
            ))}
          </select>
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              editable
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
            }`}
            onClick={() => setEditable(!editable)}
          >
            {editable ? t("wbs.lockEdit") : t("wbs.unlockEdit")}
          </button>
          <button
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            onClick={handleSync}
            disabled={loading}
          >
            {loading ? t("common.syncing") : t("common.syncFromPlane")}
          </button>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!selectedProject ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p className="text-4xl mb-4">🌳</p>
            <p className="text-base">{t("wbs.selectProjectHint")}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>{t("common.loading")}</p>
          </div>
        ) : wbsData && wbsData.tree.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <WBSTree tree={wbsData.tree} editable={editable} onSave={handleSave} />
          </div>
        ) : wbsData ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-base font-medium">{t("wbs.noWorkitems")}</p>
            <p className="text-sm mt-2">{t("wbs.syncFirst")}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
