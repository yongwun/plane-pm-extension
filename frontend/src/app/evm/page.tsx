"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  projects, baseline as blApi, evm as evmApi,
  type ProjectExt, type Baseline, type EVMResult,
} from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import * as echarts from "echarts";

/* ---------- helpers ---------- */

function fmtMoney(v: number) {
  if (Math.abs(v) >= 10000) return `¥${(v / 10000).toFixed(1)}万`;
  return `¥${v.toFixed(0)}`;
}

function fmtPct(v: number) {
  return v.toFixed(2);
}

function kpiColor(v: number, invert = false) {
  const good = invert ? v < 1 : v >= 1;
  if (v === 0) return "text-slate-400 dark:text-slate-500";
  return good
    ? "text-emerald-600 dark:text-emerald-400"
    : v >= 0.9
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
}

/* ---------- Main Component ---------- */

export default function EVMPage() {
  const { theme } = useTheme();
  const [projectList, setProjectList] = useState<ProjectExt[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [selectedBaseline, setSelectedBaseline] = useState<string>("");
  const [evmResult, setEvmResult] = useState<EVMResult | null>(null);
  const [evmHistory, setEvmHistory] = useState<EVMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusDate, setStatusDate] = useState("2026-11-15");

  // New baseline form
  const [newBlName, setNewBlName] = useState("");
  const [showBlForm, setShowBlForm] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    projects.list().then(setProjectList).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setBaselines([]);
      setEvmResult(null);
      setEvmHistory([]);
      return;
    }
    blApi.list(selectedProject).then(setBaselines).catch(console.error);
    evmApi.history(selectedProject).then(setEvmHistory).catch(() => setEvmHistory([]));
  }, [selectedProject]);

  // ECharts S-curve
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    const isDark = theme === "dark";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const axisLineColor = isDark ? "#334155" : "#e2e8f0";

    // Build chart from history or single result
    const dataPoints = evmHistory.length > 0 ? evmHistory : evmResult ? [evmResult] : [];

    if (dataPoints.length === 0) {
      chart.clear();
      chart.setOption({
        title: {
          text: "暂无 EVM 数据",
          left: "center",
          top: "center",
          textStyle: { color: textColor, fontSize: 14, fontWeight: "normal" },
        },
      });
      return;
    }

    const dates = dataPoints.map((d) => d.status_date);
    const pvData = dataPoints.map((d) => d.pv);
    const evData = dataPoints.map((d) => d.ev);
    const acData = dataPoints.map((d) => d.ac);
    const bacLine = dataPoints.map((d) => d.bac);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#1e293b" : "#fff",
        borderColor: isDark ? "#475569" : "#e2e8f0",
        textStyle: { color: isDark ? "#e2e8f0" : "#0f172a", fontSize: 13 },
      },
      legend: {
        data: ["PV 计划值", "EV 挣值", "AC 实际成本", "BAC 预算"],
        textStyle: { color: textColor, fontSize: 12 },
        top: 0,
      },
      grid: { left: 80, right: 30, top: 50, bottom: 40 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 12 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: axisLineColor, type: "dashed" } },
        axisLabel: {
          color: textColor,
          fontSize: 12,
          formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`),
        },
      },
      series: [
        {
          name: "PV 计划值",
          type: "line",
          data: pvData,
          smooth: true,
          lineStyle: { width: 2.5, color: "#3b82f6" },
          itemStyle: { color: "#3b82f6" },
          areaStyle: { color: "rgba(59,130,246,0.08)" },
        },
        {
          name: "EV 挣值",
          type: "line",
          data: evData,
          smooth: true,
          lineStyle: { width: 2.5, color: "#10b981" },
          itemStyle: { color: "#10b981" },
          areaStyle: { color: "rgba(16,185,129,0.08)" },
        },
        {
          name: "AC 实际成本",
          type: "line",
          data: acData,
          smooth: true,
          lineStyle: { width: 2.5, color: "#f59e0b" },
          itemStyle: { color: "#f59e0b" },
        },
        {
          name: "BAC 预算",
          type: "line",
          data: bacLine,
          lineStyle: { width: 1.5, type: "dashed", color: "#94a3b8" },
          itemStyle: { color: "#94a3b8" },
          symbol: "none",
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [evmResult, evmHistory, theme]);

  const handleCreateBaseline = async () => {
    if (!selectedProject || !newBlName.trim()) return;
    try {
      setLoading(true);
      const bl = await blApi.create(selectedProject, {
        project_ext_id: selectedProject,
        name: newBlName.trim(),
      });
      setNewBlName("");
      setShowBlForm(false);
      setBaselines(await blApi.list(selectedProject));
      setSelectedBaseline(bl.id);
    } catch (e: unknown) {
      setError((e as Error).message || "创建基线失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateEVM = async () => {
    if (!selectedProject) return;
    try {
      setLoading(true);
      setError("");
      const result = await evmApi.calculate({
        project_ext_id: selectedProject,
        baseline_id: selectedBaseline || undefined,
        status_date: statusDate || undefined,
      });
      setEvmResult(result);
      setEvmHistory(await evmApi.history(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "EVM 计算失败");
    } finally {
      setLoading(false);
    }
  };

  const r = evmResult;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ← 首页
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">挣值分析 (EVM)</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">选择项目...</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.plane_project_name || p.plane_project_id}
              </option>
            ))}
          </select>
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
            <p className="text-4xl mb-4">📈</p>
            <p className="text-base">请先选择一个项目</p>
          </div>
        ) : (
          <>
            {/* ---- Controls ---- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">基线：</span>
                <select
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={selectedBaseline}
                  onChange={(e) => setSelectedBaseline(e.target.value)}
                >
                  <option value="">使用活跃基线</option>
                  {baselines.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.items_count}项, {b.baseline_date.slice(0, 10)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowBlForm(!showBlForm)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {showBlForm ? "取消" : "+ 新建基线"}
                </button>
                <button
                  onClick={handleCalculateEVM}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {loading ? "计算中..." : "计算 EVM"}
                </button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">状态日期：</span>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                {r && (
                  <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                    状态日期: {r.status_date} · BAC: {fmtMoney(r.bac)}
                  </span>
                )}
              </div>
              {showBlForm && (
                <div className="mt-3 flex gap-3">
                  <input
                    placeholder="基线名称 (如: 初始基线 v1)"
                    value={newBlName}
                    onChange={(e) => setNewBlName(e.target.value)}
                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleCreateBaseline}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    创建
                  </button>
                </div>
              )}
            </div>

            {/* ---- KPI Cards ---- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "SPI 进度绩效", value: r ? fmtPct(r.spi) : "—", color: kpiColor(r?.spi || 0), desc: r ? (r.spi >= 1 ? "进度超前" : "进度落后") : "" },
                { label: "CPI 成本绩效", value: r ? fmtPct(r.cpi) : "—", color: kpiColor(r?.cpi || 0), desc: r ? (r.cpi >= 1 ? "成本节省" : "成本超支") : "" },
                { label: "EAC 完工估算", value: r ? fmtMoney(r.eac) : "—", color: "text-slate-800 dark:text-slate-200", desc: r ? `BAC: ${fmtMoney(r.bac)}` : "" },
                { label: "VAC 完工偏差", value: r ? fmtMoney(r.vac) : "—", color: r ? (r.vac >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-slate-400", desc: r ? (r.vac >= 0 ? "预计结余" : "预计超支") : "" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className={`text-3xl font-bold ${kpi.color} mt-2`}>{kpi.value}</p>
                  {kpi.desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{kpi.desc}</p>}
                </div>
              ))}
            </div>

            {/* ---- Extra KPI row ---- */}
            {r && (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "PV 计划值", value: fmtMoney(r.pv) },
                  { label: "EV 挣值", value: fmtMoney(r.ev) },
                  { label: "AC 实际成本", value: fmtMoney(r.ac) },
                  { label: "SV 进度偏差", value: fmtMoney(r.sv) },
                  { label: "CV 成本偏差", value: fmtMoney(r.cv) },
                  { label: "TCPI", value: fmtPct(r.tcpi) },
                ].map((item) => (
                  <div key={item.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ---- S Curve ---- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="font-bold text-slate-900 dark:text-white mb-4 text-base">S 曲线 (PV / EV / AC)</h2>
              <div ref={chartRef} style={{ width: "100%", height: 400 }} />
            </div>

            {/* ---- Task Details ---- */}
            {r && r.task_details && r.task_details.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="font-bold text-slate-900 dark:text-white text-base">任务级别 EVM 明细</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">WBS</th>
                        <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">任务</th>
                        <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">PV</th>
                        <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">EV</th>
                        <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">AC</th>
                        <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">计划%</th>
                        <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">实际%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.task_details.map((t) => (
                        <tr key={t.workitem_id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">{t.wbs_code || "—"}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{t.name}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{fmtMoney(t.pv)}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{fmtMoney(t.ev)}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{fmtMoney(t.ac)}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{(t.planned_percent * 100).toFixed(0)}%</td>
                          <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{(t.actual_percent * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
