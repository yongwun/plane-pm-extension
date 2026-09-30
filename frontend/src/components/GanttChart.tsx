"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "./ThemeProvider";
import { useLang } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface GanttTask {
  id: string;
  plane_workitem_id: string;
  name: string;
  wbs_code: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  is_milestone: boolean;
  is_critical: boolean;
  percent_complete: number;
  early_start: string | null;
  early_finish: string | null;
  late_start: string | null;
  late_finish: string | null;
  total_float: number | null;
  free_float: number | null;
}

export interface GanttDependency {
  id: string;
  source: string;
  target: string;
  type: string;
  lag: number;
}

export interface GanttData {
  project_id: string;
  project_name: string;
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  critical_path: string[];
  summary: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY_PX = 44;
const ROW_H = 52;
const HEADER_H = 56;
const TABLE_W = 580;

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDateFull(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function GanttChart({ data }: { data: GanttData }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { t: tr } = useLang();
  const dark = theme === "dark";

  const { rangeStart, rangeDays, tasksSorted } = useMemo(() => {
    if (!data.tasks.length) {
      return { rangeStart: new Date(), rangeDays: 30, tasksSorted: [] };
    }
    const sorted = [...data.tasks].sort((a, b) => {
      const da = a.start_date ? new Date(a.start_date).getTime() : 0;
      const db = b.start_date ? new Date(b.start_date).getTime() : 0;
      return da - db;
    });
    let min = Infinity;
    let max = -Infinity;
    for (const t of sorted) {
      if (t.start_date) {
        const s = new Date(t.start_date).getTime();
        if (s < min) min = s;
      }
      if (t.end_date) {
        const e = new Date(t.end_date).getTime();
        if (e > max) max = e;
      }
    }
    const start = addDays(new Date(min), -3);
    const end = addDays(new Date(max), 5);
    return { rangeStart: start, rangeDays: daysBetween(start, end), tasksSorted: sorted };
  }, [data.tasks]);

  const taskPosMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; w: number }> = {};
    tasksSorted.forEach((t, idx) => {
      if (!t.start_date || !t.end_date) return;
      const s = new Date(t.start_date);
      const e = new Date(t.end_date);
      const x = daysBetween(rangeStart, s) * DAY_PX;
      const w = Math.max(DAY_PX, (daysBetween(s, e) + 1) * DAY_PX);
      const y = HEADER_H + idx * ROW_H + ROW_H / 2;
      map[t.id] = { x, y, w };
    });
    return map;
  }, [tasksSorted, rangeStart]);

  useEffect(() => {
    if (scrollRef.current && data.tasks.length) {
      const todayOffset = daysBetween(rangeStart, new Date()) * DAY_PX - TABLE_W;
      if (todayOffset > 0) scrollRef.current.scrollLeft = todayOffset;
    }
  }, [data.tasks, rangeStart]);

  if (!data.tasks.length) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-lg">{tr("gantt.noTaskData")}</div>
    );
  }

  const dateColumns: { date: Date; isWeekend: boolean; isMonday: boolean }[] = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = addDays(rangeStart, i);
    const dow = d.getDay();
    dateColumns.push({ date: d, isWeekend: dow === 0 || dow === 6, isMonday: dow === 1 });
  }

  const summary = data.summary as Record<string, string | number>;
  const criticalIds = new Set(data.critical_path);

  // Color tokens
  const c = {
    summaryBg: dark ? "#1e293b" : "#334155",
    headerBg: dark ? "#1e293b" : "#f1f5f9",
    headerBorder: dark ? "#334155" : "#cbd5e1",
    headerText: dark ? "#e2e8f0" : "#334155",
    rowBg: dark ? "#0f172a" : "#ffffff",
    rowAltBg: dark ? "#1e293b" : "#f8fafc",
    rowCritBg: dark ? "#450a0a22" : "#fef2f2",
    rowBorder: dark ? "#1e293b" : "#e2e8f0",
    nameText: dark ? "#f1f5f9" : "#1e293b",
    dimText: dark ? "#94a3b8" : "#64748b",
    weekendBg: dark ? "#1e293b88" : "#f1f5f9",
    weekendBarBg: dark ? "#292524" : "#fef2f2",
    weekendText: dark ? "#fb923c" : "#e11d48",
    gridBorder: dark ? "#1e293b" : "#f1f5f9",
    arrowNormal: dark ? "#94a3b8" : "#64748b",
    arrowCritical: dark ? "#f87171" : "#dc2626",
    tooltipBg: dark ? "#0f172a" : "#1e293b",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div
        className="flex items-center gap-8 px-5 py-3 text-white text-sm rounded-t-xl"
        style={{ background: c.summaryBg }}
      >
        <span className="font-medium">
          <span className="opacity-60 mr-1">{tr("gantt.thStart")}</span>
          {summary.project_start ? fmtDateFull(new Date(summary.project_start as string)) : "-"}
        </span>
        <span className="font-medium">
          <span className="opacity-60 mr-1">{tr("gantt.thEnd")}</span>
          {summary.project_end ? fmtDateFull(new Date(summary.project_end as string)) : "-"}
        </span>
        <span className="font-bold text-amber-300">
          {String(summary.total_duration_days ?? "-")} {tr("gantt.workDays")}
        </span>
        <span>{String(summary.total_tasks ?? data.tasks.length)} {tr("gantt.tasks")}</span>
        <span
          className="px-2.5 py-0.5 rounded font-semibold"
          style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          {String(summary.critical_tasks ?? 0)} {tr("gantt.criticalTasks")}
        </span>
      </div>

      <div
        className="flex flex-1 rounded-b-xl overflow-hidden"
        style={{ border: `1px solid ${c.headerBorder}` }}
      >
        {/* ---- Left table ---- */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: TABLE_W, borderRight: `2px solid ${c.headerBorder}`, background: c.rowBg }}
        >
          {/* Header */}
          <div
            className="flex items-center text-[13px] font-bold"
            style={{ height: HEADER_H, background: c.headerBg, borderBottom: `2px solid ${c.headerBorder}`, color: c.headerText }}
          >
            <div className="w-10 text-center">#</div>
            <div className="flex-1 px-3">{tr("gantt.thTaskName")}</div>
            <div className="w-[68px] text-center">{tr("gantt.thDuration")}</div>
            <div className="w-[76px] text-center">{tr("gantt.thStart")}</div>
            <div className="w-[76px] text-center">{tr("gantt.thEnd")}</div>
            <div className="w-16 text-center">{tr("gantt.thProgress")}</div>
          </div>
          {/* Rows */}
          {tasksSorted.map((t, idx) => {
            const isCrit = criticalIds.has(t.id);
            const bg = isCrit ? c.rowCritBg : idx % 2 === 0 ? c.rowBg : c.rowAltBg;
            return (
              <div
                key={t.id}
                className="flex items-center text-[13px] transition-colors"
                style={{ height: ROW_H, background: bg, borderBottom: `1px solid ${c.rowBorder}` }}
              >
                <div className="w-10 text-center font-mono text-xs" style={{ color: c.dimText }}>{idx + 1}</div>
                <div className="flex-1 px-3 truncate font-semibold" style={{ color: c.nameText }} title={t.name}>
                  {t.is_milestone && <span className="text-amber-500 mr-1.5 text-base">◆</span>}
                  {isCrit && <span className="text-red-500 mr-1.5 text-base">●</span>}
                  {t.name}
                </div>
                <div className="w-[68px] text-center font-mono" style={{ color: c.dimText }}>{t.duration_days}d</div>
                <div className="w-[76px] text-center font-mono text-xs" style={{ color: c.dimText }}>
                  {t.start_date ? fmtDateFull(new Date(t.start_date)).slice(5) : "-"}
                </div>
                <div className="w-[76px] text-center font-mono text-xs" style={{ color: c.dimText }}>
                  {t.end_date ? fmtDateFull(new Date(t.end_date)).slice(5) : "-"}
                </div>
                <div className="w-16 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: t.percent_complete >= 1
                        ? (dark ? "#064e3b" : "#d1fae5")
                        : t.percent_complete > 0
                          ? (dark ? "#0c4a6e" : "#e0f2fe")
                          : (dark ? "#334155" : "#e2e8f0"),
                      color: t.percent_complete >= 1
                        ? (dark ? "#6ee7b7" : "#059669")
                        : t.percent_complete > 0
                          ? (dark ? "#7dd3fc" : "#0284c7")
                          : (dark ? "#94a3b8" : "#475569"),
                    }}
                  >
                    {Math.round(t.percent_complete * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Right timeline ---- */}
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div style={{ width: rangeDays * DAY_PX, minHeight: HEADER_H + tasksSorted.length * ROW_H }}>
            {/* Date header */}
            <div
              className="flex sticky top-0 z-10"
              style={{ height: HEADER_H, background: c.headerBg, borderBottom: `2px solid ${c.headerBorder}` }}
            >
              {dateColumns.map((col, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 text-center flex flex-col justify-center"
                  style={{
                    width: DAY_PX,
                    background: col.isWeekend ? c.weekendBg : "transparent",
                    borderRight: `1px solid ${c.gridBorder}`,
                  }}
                >
                  <span
                    className="text-xs font-bold leading-tight"
                    style={{ color: col.isMonday ? c.headerText : c.dimText }}
                  >
                    {col.date.getMonth() + 1}/{col.date.getDate()}
                  </span>
                  <span
                    className="text-[11px] leading-tight font-semibold"
                    style={{ color: col.isWeekend ? c.weekendText : c.dimText }}
                  >
                    {tr(`gantt.weekday.${WEEKDAY_KEYS[col.date.getDay()]}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* Task bars area */}
            <div className="relative">
              {/* Weekend columns */}
              <div className="absolute inset-0 flex pointer-events-none">
                {dateColumns.map((col, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0"
                    style={{
                      width: DAY_PX,
                      height: tasksSorted.length * ROW_H,
                      background: col.isWeekend ? c.weekendBarBg : "transparent",
                      borderRight: `1px solid ${c.gridBorder}`,
                    }}
                  />
                ))}
              </div>

              {/* Row stripes */}
              {tasksSorted.map((t, idx) => {
                const bg = criticalIds.has(t.id)
                  ? c.rowCritBg
                  : idx % 2 === 0
                    ? "transparent"
                    : c.rowAltBg;
                return (
                  <div
                    key={t.id}
                    className="absolute w-full"
                    style={{
                      top: idx * ROW_H,
                      height: ROW_H,
                      background: bg,
                      borderBottom: `1px solid ${c.rowBorder}`,
                    }}
                  />
                );
              })}

              {/* Task bars */}
              {tasksSorted.map((t, idx) => {
                if (!t.start_date || !t.end_date) return null;
                const s = new Date(t.start_date);
                const e = new Date(t.end_date);
                const x = daysBetween(rangeStart, s) * DAY_PX;
                const w = Math.max(DAY_PX, (daysBetween(s, e) + 1) * DAY_PX);
                const isCrit = criticalIds.has(t.id);

                if (t.is_milestone) {
                  return (
                    <div
                      key={t.id}
                      className="absolute group"
                      style={{ left: x - 12, top: idx * ROW_H + ROW_H / 2 - 14, zIndex: 5 }}
                    >
                      <div
                        className="w-7 h-7 rotate-45 shadow-lg"
                        style={{
                          background: "#f59e0b",
                          border: "3px solid #d97706",
                        }}
                        title={`${t.name}\n${fmtDateFull(s)}`}
                      />
                      <div
                        className="absolute -top-9 left-9 hidden group-hover:block text-sm px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50"
                        style={{ background: c.tooltipBg, color: "#fff" }}
                      >
                        {t.name} — {fmtDateFull(s)}
                      </div>
                    </div>
                  );
                }

                const barBg = isCrit
                  ? (dark ? "linear-gradient(to right, #dc2626, #ef4444)" : "linear-gradient(to right, #ef4444, #f87171)")
                  : (dark ? "linear-gradient(to right, #0284c7, #38bdf8)" : "linear-gradient(to right, #0ea5e9, #7dd3fc)");
                const barBorder = isCrit
                  ? (dark ? "#f87171" : "#dc2626")
                  : (dark ? "#38bdf8" : "#0284c7");
                const progressBg = isCrit
                  ? (dark ? "rgba(127,29,29,0.6)" : "rgba(185,28,28,0.4)")
                  : (dark ? "rgba(7,89,133,0.5)" : "rgba(3,105,161,0.3)");

                return (
                  <div
                    key={t.id}
                    className="absolute group"
                    style={{ left: x, top: idx * ROW_H + 10, width: w, height: ROW_H - 20, zIndex: 5 }}
                  >
                    <div
                      className="h-full rounded-lg shadow-md"
                      style={{ background: barBg, border: `2px solid ${barBorder}` }}
                    >
                      {t.percent_complete > 0 && t.percent_complete < 1 && (
                        <div
                          className="h-full rounded-l-md"
                          style={{ width: `${t.percent_complete * 100}%`, background: progressBg }}
                        />
                      )}
                      {t.percent_complete >= 1 && (
                        <div className="h-full rounded-md" style={{ background: "#10b981" }} />
                      )}
                    </div>
                    {w > 70 && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-xs font-bold truncate px-2"
                        style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                      >
                        {t.name}
                      </span>
                    )}
                    <div
                      className="absolute -top-9 left-0 hidden group-hover:block text-sm px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50"
                      style={{ background: c.tooltipBg, color: "#fff" }}
                    >
                      {t.name} | {fmtDateFull(s)} → {fmtDateFull(e)} | {t.duration_days}d
                      {t.total_float != null && ` | ${tr("gantt.floatLabel")}: ${t.total_float}d`}
                    </div>
                  </div>
                );
              })}

              {/* Dependency arrows */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: rangeDays * DAY_PX, height: tasksSorted.length * ROW_H }}
              >
                <defs>
                  <marker id="arr" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                    <polygon points="0 0, 10 4, 0 8" fill={c.arrowNormal} />
                  </marker>
                  <marker id="arr-red" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                    <polygon points="0 0, 10 4, 0 8" fill={c.arrowCritical} />
                  </marker>
                </defs>
                {data.dependencies.map((dep) => {
                  const from = taskPosMap[dep.source];
                  const to = taskPosMap[dep.target];
                  if (!from || !to) return null;
                  const isCritical = criticalIds.has(dep.source) && criticalIds.has(dep.target);
                  const color = isCritical ? c.arrowCritical : c.arrowNormal;
                  const marker = isCritical ? "url(#arr-red)" : "url(#arr)";
                  const x1 = from.x + from.w;
                  const y1 = from.y;
                  const x2 = to.x;
                  const y2 = to.y;
                  const midX = x1 + (x2 - x1) / 2;
                  return (
                    <path
                      key={dep.id}
                      d={`M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`}
                      stroke={color}
                      strokeWidth={isCritical ? 2.5 : 2}
                      fill="none"
                      markerEnd={marker}
                    />
                  );
                })}
              </svg>

              {/* Today line */}
              {(() => {
                const todayX = daysBetween(rangeStart, new Date()) * DAY_PX;
                if (todayX > 0 && todayX < rangeDays * DAY_PX) {
                  return (
                    <div
                      className="absolute z-20"
                      style={{
                        left: todayX,
                        top: 0,
                        width: 3,
                        height: tasksSorted.length * ROW_H,
                        background: "#f97316",
                        boxShadow: "0 0 4px rgba(249,115,22,0.4)",
                      }}
                    >
                      <div
                        className="absolute -left-2.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ top: -2, background: "#f97316", color: "#fff" }}
                      >
                        {tr("gantt.today")}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-8 mt-4 text-sm px-2" style={{ color: c.dimText }}>
        <span className="flex items-center gap-2">
          <span className="w-5 h-3 rounded shadow-sm" style={{ background: dark ? "#0ea5e9" : "#0284c7" }} />
          <span className="font-medium">{tr("gantt.normalTask")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-5 h-3 rounded shadow-sm" style={{ background: "#ef4444" }} />
          <span className="font-medium">{tr("gantt.criticalPath")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rotate-45" style={{ background: "#f59e0b", border: "2px solid #d97706" }} />
          <span className="font-medium">{tr("gantt.milestone")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-5 h-3 rounded shadow-sm" style={{ background: "#10b981" }} />
          <span className="font-medium">{tr("gantt.completed")}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-1 h-4 rounded" style={{ background: "#f97316" }} />
          <span className="font-medium">{tr("gantt.today")}</span>
        </span>
      </div>
    </div>
  );
}
