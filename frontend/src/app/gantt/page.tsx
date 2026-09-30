"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  projects, gantt,
  type ProjectExt, type GanttData, type GanttTask, type GanttDependency, type WorkitemUpdate,
} from "@/lib/api";
import GanttChart from "@/components/GanttChart";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";
import {
  InlineEditNumber, InlineEditDate, InlineEditToggle, InlineEditSelect,
} from "@/components/InlineEdit";

/* ---------- helpers ---------- */

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.slice(5, 10);
}

/* ---------- Editable Task Table ---------- */

function TaskTable({
  tasks,
  projectExtId,
  onUpdate,
}: {
  tasks: GanttTask[];
  projectExtId: string;
  onUpdate: () => void;
}) {
  const { t } = useLang();
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (taskId: string, data: WorkitemUpdate) => {
    setSaving(taskId);
    try {
      await gantt.updateWorkitem(projectExtId, taskId, data);
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
            <th className="py-2 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-8">#</th>
            <th className="py-2 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t("gantt.thTaskName")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-20">{t("gantt.thDuration")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-28">{t("gantt.thStart")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-28">{t("gantt.thEnd")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-24">{t("gantt.thProgress")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-16">{t("gantt.thMilestone")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-20">{t("gantt.thCost")}</th>
            <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-14">{t("gantt.thFloat")}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr
              key={t.id}
              className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                t.is_critical ? "bg-red-50/50 dark:bg-red-900/10" : ""
              } ${saving === t.id ? "opacity-60" : ""}`}
            >
              <td className="py-2 px-3 text-slate-400 text-xs">{i + 1}</td>
              <td className="py-2 px-3">
                <span className={`font-medium ${t.is_critical ? "text-red-700 dark:text-red-400" : "text-slate-800 dark:text-slate-200"}`}>
                  {t.is_critical && <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1.5" />}
                  {t.name}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <InlineEditNumber value={t.duration_days} min={0} step={1} suffix="d" onSave={(v) => save(t.id, { duration_days: v })} />
              </td>
              <td className="py-2 px-3 text-center">
                <InlineEditDate value={t.start_date || ""} onSave={(v) => save(t.id, { constraint_type: "SNET", constraint_date: v })} />
              </td>
              <td className="py-2 px-3 text-center">
                <span className="text-slate-500 dark:text-slate-400 font-mono">{fmtDate(t.end_date)}</span>
              </td>
              <td className="py-2 px-3 text-center">
                <InlineEditNumber value={Math.round(t.percent_complete * 100)} min={0} max={100} step={5} suffix="%" onSave={(v) => save(t.id, { percent_complete: v / 100 })} />
              </td>
              <td className="py-2 px-3 text-center">
                <InlineEditToggle value={t.is_milestone} onSave={(v) => save(t.id, { is_milestone: v })} labelOn="◆" labelOff="—" />
              </td>
              <td className="py-2 px-3 text-center">
                <InlineEditNumber value={t.fixed_cost || 0} min={0} step={1000} suffix="" onSave={(v) => save(t.id, { fixed_cost: v })} />
              </td>
              <td className="py-2 px-3 text-center text-xs">
                <span className={`font-mono ${
                  t.total_float === null ? "text-slate-400" :
                  t.total_float <= 0 ? "text-red-500 font-bold" :
                  "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {t.total_float !== null ? t.total_float.toFixed(0) : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Dependency Panel ---------- */

function DepPanel({
  projectExtId,
  deps,
  tasks,
  onUpdate,
}: {
  projectExtId: string;
  deps: GanttDependency[];
  tasks: GanttTask[];
  onUpdate: () => void;
}) {
  const { t } = useLang();
  const [newSrc, setNewSrc] = useState("");
  const [newTgt, setNewTgt] = useState("");
  const [newType, setNewType] = useState("FS");
  const [show, setShow] = useState(false);

  const taskName = (id: string) => tasks.find((t) => t.id === id)?.name || id.slice(0, 8);

  const handleAdd = async () => {
    if (!newSrc || !newTgt) return;
    const srcTask = tasks.find((t) => t.id === newSrc);
    const tgtTask = tasks.find((t) => t.id === newTgt);
    if (!srcTask || !tgtTask) return;
    try {
      await gantt.createDependency(projectExtId, {
        predecessor_workitem_id: srcTask.plane_workitem_id,
        successor_workitem_id: tgtTask.plane_workitem_id,
        dependency_type: newType,
        lag_days: 0,
      });
      setNewSrc("");
      setNewTgt("");
      setShow(false);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDel = async (depId: string) => {
    try {
      await gantt.deleteDependency(projectExtId, depId);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          {t("gantt.dependencies")} <span className="text-slate-400 font-normal">({deps.length})</span>
        </h3>
        <button
          onClick={() => setShow(!show)}
          className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300"
        >
          {show ? t("common.cancel") : t("common.add")}
        </button>
      </div>
      {show && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex gap-2 flex-wrap">
          <select value={newSrc} onChange={(e) => setNewSrc(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
            <option value="">{t("gantt.predecessor")}</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span className="text-slate-400 self-center">→</span>
          <select value={newTgt} onChange={(e) => setNewTgt(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
            <option value="">{t("gantt.successor")}</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-20">
            <option value="FS">FS</option>
            <option value="SS">SS</option>
            <option value="FF">FF</option>
            <option value="SF">SF</option>
          </select>
          <button onClick={handleAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            {t("common.confirm")}
          </button>
        </div>
      )}
      {deps.length > 0 && (
        <div className="px-5 py-2">
          {deps.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 text-sm">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{taskName(d.source)}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">{d.type}</span>
              <span className="text-slate-400">→</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{taskName(d.target)}</span>
              <button onClick={() => handleDel(d.id)}
                className="ml-auto text-red-400 hover:text-red-600 text-xs">{t("common.delete")}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Project Settings Panel ---------- */

function ProjectSettings({
  project,
  onUpdate,
}: {
  project: ProjectExt;
  onUpdate: () => void;
}) {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const save = async (data: Partial<ProjectExt>) => {
    try {
      await projects.update(project.id, data);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        ⚙ {t("gantt.projectSettings")}
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t("gantt.projectSettings")}</h3>
        <button onClick={() => setShow(false)} className="text-sm text-slate-400 hover:text-slate-600">✕ {t("common.close")}</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t("gantt.budget")}</label>
          <InlineEditNumber value={project.budget} min={0} step={10000} onSave={(v) => save({ budget: v })} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t("gantt.workHoursPerDay")}</label>
          <InlineEditNumber value={project.work_hours_per_day} min={1} max={24} step={0.5} onSave={(v) => save({ work_hours_per_day: v })} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t("gantt.workDaysPerWeek")}</label>
          <InlineEditNumber value={project.work_days_per_week} min={1} max={7} step={1} onSave={(v) => save({ work_days_per_week: v })} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t("gantt.currency")}</label>
          <InlineEditSelect value={project.currency} options={[
            { value: "CNY", label: "CNY ¥" },
            { value: "USD", label: "USD $" },
            { value: "EUR", label: "EUR €" },
          ]} onSave={(v) => save({ currency: v })} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function GanttPage() {
  const { t } = useLang();
  const [projectList, setProjectList] = useState<ProjectExt[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<ProjectExt | null>(null);
  const [ganttData, setGanttData] = useState<GanttData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState<"chart" | "table">("chart");

  const loadData = useCallback(async (pid: string) => {
    setLoading(true);
    setError("");
    try {
      const [data, proj] = await Promise.all([
        gantt.getData(pid),
        projects.get(pid),
      ]);
      setGanttData(data);
      setCurrentProject(proj);
    } catch (e: unknown) {
      setError((e as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    projects.list().then(setProjectList).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) { setGanttData(null); setCurrentProject(null); return; }
    loadData(selectedProject);
  }, [selectedProject, loadData]);

  const handleSync = async () => {
    try {
      setLoading(true);
      const list = await projects.syncFromPlane();
      setProjectList(list);
      if (selectedProject) {
        await projects.syncWorkitems(selectedProject);
        await loadData(selectedProject);
      }
    } catch (e: unknown) {
      setError((e as Error).message || "同步失败");
    } finally { setLoading(false); }
  };

  const refresh = () => { if (selectedProject) loadData(selectedProject); };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ← {t("common.home")}
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("gantt.title")}</h1>
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
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            onClick={handleSync}
            disabled={loading}
          >
            {loading ? t("common.syncing") : t("common.syncFromPlane")}
          </button>
          {selectedProject && (
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              onClick={refresh}
              disabled={loading}
            >
              {t("common.refreshCPM")}
            </button>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!selectedProject ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-base">{t("gantt.selectProjectHint")}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>{t("common.loading")}</p>
          </div>
        ) : ganttData ? (
          <>
            {/* Project settings */}
            {currentProject && (
              <ProjectSettings project={currentProject} onUpdate={refresh} />
            )}

            {/* Tab switch */}
            <div className="flex items-center gap-2">
              <button
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === "chart"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
                onClick={() => setTab("chart")}
              >
                {t("gantt.tabChart")}
              </button>
              <button
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === "table"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
                onClick={() => setTab("table")}
              >
                {t("gantt.tabTable")}
              </button>
            </div>

            {tab === "chart" ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4" style={{ minHeight: 500 }}>
                <GanttChart data={ganttData} />
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {t("gantt.tableHint")}
                </p>
                <TaskTable
                  tasks={ganttData.tasks}
                  projectExtId={selectedProject}
                  onUpdate={refresh}
                />
              </div>
            )}

            {/* Dependency panel */}
            <DepPanel
              projectExtId={selectedProject}
              deps={ganttData.dependencies}
              tasks={ganttData.tasks}
              onUpdate={refresh}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
