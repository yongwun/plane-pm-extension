"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  projects, baseline as blApi, gantt as ganttApi,
  type ProjectExt, type Baseline, type BaselineItem,
} from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import * as echarts from "echarts";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Snapshot {
  label: string;
  date: string;
}

interface MilestoneTrend {
  name: string;
  dates: (string | null)[]; // one per snapshot; null = not present
}

/* ------------------------------------------------------------------ */
/* Demo data generator                                                  */
/* ------------------------------------------------------------------ */

function generateDemoData(): { snapshots: Snapshot[]; milestones: MilestoneTrend[] } {
  const snapshots: Snapshot[] = [
    { label: "基线 v1", date: "2026-01-15" },
    { label: "基线 v2", date: "2026-03-15" },
    { label: "基线 v3", date: "2026-06-15" },
    { label: "当前", date: "2026-09-01" },
  ];
  const milestones: MilestoneTrend[] = [
    { name: "需求评审",   dates: ["2026-02-28", "2026-03-05", "2026-03-10", "2026-03-15"] },
    { name: "设计冻结",   dates: ["2026-04-15", "2026-04-15", "2026-04-15", "2026-04-15"] },
    { name: "原型评审",   dates: ["2026-05-30", "2026-06-15", "2026-07-10", "2026-07-25"] },
    { name: "Alpha 发布", dates: ["2026-07-31", "2026-08-15", "2026-09-10", "2026-09-30"] },
    { name: "Beta 发布",  dates: ["2026-09-30", "2026-10-15", "2026-10-30", "2026-11-10"] },
    { name: "正式上线",   dates: ["2026-11-30", "2026-11-30", "2026-12-15", "2027-01-15"] },
  ];
  return { snapshots, milestones };
}

/* ------------------------------------------------------------------ */
/* Color palette                                                        */
/* ------------------------------------------------------------------ */

const PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function fmtDate(d: string | null) {
  if (!d) return "-";
  return d.slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */

export default function MTAPage() {
  const { t } = useLang();
  const { theme } = useTheme();

  const [projectList, setProjectList] = useState<ProjectExt[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [milestones, setMilestones] = useState<MilestoneTrend[]>([]);
  const [dataSource, setDataSource] = useState<"demo" | "baseline">("demo");

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  /* --- Load projects --- */
  useEffect(() => {
    projects.list().then(setProjectList).catch(console.error);
  }, []);

  /* --- Load MTA data from baselines --- */
  const loadData = async (pid: string) => {
    setLoading(true);
    setError("");
    try {
      const baselines = await blApi.list(pid);
      if (baselines.length === 0) {
        const demo = generateDemoData();
        setSnapshots(demo.snapshots);
        setMilestones(demo.milestones);
        setDataSource("demo");
        return;
      }

      // Sort baselines by date
      const sorted = [...baselines].sort(
        (a, b) => new Date(a.baseline_date).getTime() - new Date(b.baseline_date).getTime()
      );

      // Fetch items for each baseline
      const allItems = await Promise.all(
        sorted.map((bl) => blApi.getItems(pid, bl.id))
      );

      // Add "Current" snapshot from live gantt data
      let currentMilestones: Map<string, string> = new Map();
      try {
        const ganttData = await ganttApi.getData(pid);
        for (const task of ganttData.tasks) {
          if (task.is_milestone && task.end_date) {
            currentMilestones.set(task.name, task.end_date);
          }
        }
      } catch {
        // ignore if gantt data unavailable
      }

      // Build snapshot list
      const snaps: Snapshot[] = sorted.map((bl) => ({
        label: bl.name,
        date: bl.baseline_date.slice(0, 10),
      }));
      if (currentMilestones.size > 0) {
        snaps.push({ label: t("mta.current"), date: new Date().toISOString().slice(0, 10) });
      }

      // Collect milestone names and dates
      const milestoneNames = new Set<string>();
      const dateMap = new Map<string, Map<string, string>>();

      sorted.forEach((bl, i) => {
        const items = allItems[i];
        const blDateMap = new Map<string, string>();
        for (const item of items) {
          if (item.end_date && item.name) {
            milestoneNames.add(item.name);
            blDateMap.set(item.name, item.end_date);
          }
        }
        dateMap.set(bl.id, blDateMap);
      });

      // Add current milestone names
      for (const [name] of currentMilestones) {
        milestoneNames.add(name);
      }

      // Build milestone trend data
      const trendData: MilestoneTrend[] = Array.from(milestoneNames).map((name) => {
        const dates: (string | null)[] = sorted.map(
          (bl) => dateMap.get(bl.id)?.get(name) ?? null
        );
        if (currentMilestones.size > 0) {
          dates.push(currentMilestones.get(name) ?? null);
        }
        return { name, dates };
      });

      if (trendData.length === 0) {
        const demo = generateDemoData();
        setSnapshots(demo.snapshots);
        setMilestones(demo.milestones);
        setDataSource("demo");
      } else {
        setSnapshots(snaps);
        setMilestones(trendData);
        setDataSource("baseline");
      }
    } catch (e: unknown) {
      setError((e as Error).message || t("mta.loadFailed"));
      // Fall back to demo
      const demo = generateDemoData();
      setSnapshots(demo.snapshots);
      setMilestones(demo.milestones);
      setDataSource("demo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      loadData(selectedProject);
    }
  }, [selectedProject]);

  /* --- Render chart --- */
  const renderChart = useCallback(() => {
    if (!chartRef.current || milestones.length === 0) return;
    const dark = theme === "dark";
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    const xLabels = snapshots.map((s) => s.label);

    const series = milestones.map((ms, i) => ({
      name: ms.name,
      type: "line" as const,
      data: ms.dates.map((d) => d ? new Date(d).getTime() : null),
      connectNulls: true,
      lineStyle: { width: 2.5, color: PALETTE[i % PALETTE.length] },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      symbol: "circle",
      symbolSize: 10,
      emphasis: {
        focus: "series" as const,
        lineStyle: { width: 4 },
      },
    }));

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: dark ? "#1e293b" : "#fff",
        borderColor: dark ? "#334155" : "#e2e8f0",
        textStyle: { color: dark ? "#e2e8f0" : "#1e293b" },
        formatter: (params: unknown) => {
          const p = params as { seriesName: string; dataIndex: number; value: number };
          const d = new Date(p.value);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return `<b>${p.seriesName}</b><br/>${xLabels[p.dataIndex]}: ${dateStr}`;
        },
      },
      legend: {
        data: milestones.map((m) => m.name),
        top: 0,
        textStyle: { color: dark ? "#94a3b8" : "#64748b", fontSize: 12 },
        type: "scroll",
      },
      grid: {
        left: 90,
        right: 30,
        top: 50,
        bottom: 60,
      },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: { color: dark ? "#94a3b8" : "#64748b", fontSize: 12 },
        axisLine: { lineStyle: { color: dark ? "#334155" : "#cbd5e1" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "time",
        axisLabel: {
          color: dark ? "#94a3b8" : "#64748b",
          fontSize: 11,
          formatter: (v: number) => {
            const d = new Date(v);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          },
        },
        splitLine: { lineStyle: { color: dark ? "#1e293b" : "#f1f5f9" } },
        axisLine: { show: false },
      },
      series,
    }, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [milestones, snapshots, theme]);

  useEffect(() => {
    const cleanup = renderChart();
    return () => {
      cleanup?.();
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [renderChart]);

  /* --- Slip analysis --- */
  const slipData = milestones.map((ms) => {
    const firstDate = ms.dates.find((d) => d !== null);
    const lastDate = [...ms.dates].reverse().find((d) => d !== null);
    const slip = firstDate && lastDate ? daysBetween(firstDate, lastDate) : 0;
    return { name: ms.name, baseline: fmtDate(firstDate ?? null), current: fmtDate(lastDate ?? null), slip };
  });

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ← {t("common.home")}
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("mta.title")}</h1>
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
            onClick={() => selectedProject && loadData(selectedProject)}
            disabled={loading || !selectedProject}
          >
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!selectedProject ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p className="text-4xl mb-4">📉</p>
            <p className="text-base">{t("mta.selectProjectHint")}</p>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          <>
            {/* Data source indicator */}
            {dataSource === "demo" && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-lg text-sm">
                ℹ️ {t("mta.demoDataNotice")}
              </div>
            )}

            {/* ---- Chart ---- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="font-bold text-slate-900 dark:text-white text-base mb-4">
                {t("mta.chartTitle")}
              </h2>
              <div ref={chartRef} style={{ width: "100%", height: 460 }} />
            </div>

            {/* ---- Slip Analysis Table ---- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  {t("mta.slipAnalysis")}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t("mta.thMilestone")}</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t("mta.thBaselineDate")}</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">{t("mta.thCurrentDate")}</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">{t("mta.thSlipDays")}</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">{t("mta.thStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slipData.map((row, i) => (
                      <tr
                        key={row.name}
                        className={`border-b border-slate-100 dark:border-slate-700/50 ${
                          i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-900/30"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <span
                            className="inline-block w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                          />
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{row.baseline}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{row.current}</td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${
                          row.slip > 0
                            ? "text-red-500"
                            : row.slip < 0
                            ? "text-emerald-500"
                            : "text-slate-400"
                        }`}>
                          {row.slip > 0 ? `+${row.slip}` : row.slip}d
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.slip > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                              {t("mta.statusSlipped")}
                            </span>
                          ) : row.slip < 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                              {t("mta.statusImproved")}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              {t("mta.statusStable")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ---- Legend ---- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t("mta.howToRead")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg leading-none">↗</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{t("mta.legendSlipped")}</span>
                    <p className="text-xs mt-0.5">{t("mta.legendSlippedDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 text-lg leading-none">↘</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{t("mta.legendImproved")}</span>
                    <p className="text-xs mt-0.5">{t("mta.legendImprovedDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 text-lg leading-none">→</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{t("mta.legendStable")}</span>
                    <p className="text-xs mt-0.5">{t("mta.legendStableDesc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
