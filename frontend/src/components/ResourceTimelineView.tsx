"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { resources as resApi, type ResourceTimeline, type DayData } from "@/lib/api";
import PivotFilter, { type PivotFilterItem } from "@/components/PivotFilter";

/* ---------- helpers ---------- */

function cellColor(pct: number, isWeekend: boolean): string {
  if (isWeekend) return "bg-slate-100 dark:bg-slate-800/60";
  if (pct <= 0) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (pct < 50) return "bg-emerald-100 dark:bg-emerald-900/40";
  if (pct < 80) return "bg-amber-100 dark:bg-amber-900/40";
  if (pct < 100) return "bg-amber-200 dark:bg-amber-800/50";
  if (pct === 100) return "bg-orange-200 dark:bg-orange-800/50";
  return "bg-red-200 dark:bg-red-800/50";
}

function cellTextColor(pct: number, isWeekend: boolean): string {
  if (isWeekend) return "text-slate-300 dark:text-slate-600";
  if (pct > 100) return "text-red-700 dark:text-red-300";
  if (pct >= 80) return "text-amber-700 dark:text-amber-300";
  return "text-slate-500 dark:text-slate-400";
}

/* Month names */
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

/* ---------- Month header ---------- */

interface MonthGroup {
  label: string;
  year: number;
  days: DayData[];
  startIndex: number;
}

function groupByMonth(days: DayData[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;

  days.forEach((d, i) => {
    const dt = new Date(d.date);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (!current || `${current.year}-${current.label}` !== key) {
      current = {
        label: `${dt.getFullYear()} ${MONTHS[dt.getMonth()]}`,
        year: dt.getFullYear(),
        days: [],
        startIndex: i,
      };
      groups.push(current);
    }
    current.days.push(d);
  });

  return groups;
}

/* ---------- Tooltip ---------- */

function Tooltip({ day, x, y }: { day: DayData; x: number; y: number }) {
  const over = day.utilization_pct > 100;
  return (
    <div
      className="fixed z-50 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3 text-xs min-w-[180px]"
      style={{ left: x + 12, top: y - 60 }}
    >
      <div className="font-bold text-slate-900 dark:text-white mb-1.5">
        {day.date} ({day.day_label})
      </div>
      <div className="space-y-1 text-slate-600 dark:text-slate-300">
        <div className="flex justify-between gap-4">
          <span>可用时间</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{day.available_hours}h</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>已分配</span>
          <span className={`font-semibold ${over ? "text-red-500" : "text-sky-600 dark:text-sky-400"}`}>{day.allocated_hours}h</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-100 dark:border-slate-700 pt-1">
          <span>剩余</span>
          <span className={`font-bold ${day.remaining_hours > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {day.remaining_hours}h
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>利用率</span>
          <span className={`font-bold ${over ? "text-red-500" : "text-slate-700 dark:text-slate-200"}`}>{day.utilization_pct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */

const CELL_W = 34; // px per day cell
const NAME_W = 200; // px for left name column

export default function ResourceTimelineView() {
  const [timelines, setTimelines] = useState<ResourceTimeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tooltip, setTooltip] = useState<{ day: DayData; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTimelines(await resApi.histogram());
    } catch (e: unknown) {
      setError((e as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());

  const TYPE_MAP: Record<string, { label: string; icon: string }> = {
    human: { label: "人力", icon: "👤" },
    equipment: { label: "设备", icon: "⚙️" },
    material: { label: "材料", icon: "📦" },
    cost: { label: "费用", icon: "💰" },
  };

  const categoryItems: PivotFilterItem[] = Object.entries(TYPE_MAP).map(([key, val]) => ({
    id: key,
    label: `${val.icon} ${val.label}`,
    badge: timelines.filter((t) => t.resource_type === key).length,
  }));

  const resourceItems: PivotFilterItem[] = timelines
    .filter((t) => selectedTypes.size === 0 || selectedTypes.has(t.resource_type))
    .map((t) => ({
      id: t.resource_id,
      label: t.resource_name,
      sublabel: TYPE_MAP[t.resource_type]?.label || t.resource_type,
    }));

  // Filtered timelines
  const filteredTimelines = timelines.filter((t) => {
    if (selectedTypes.size > 0 && !selectedTypes.has(t.resource_type)) return false;
    if (selectedResources.size > 0 && !selectedResources.has(t.resource_id)) return false;
    return true;
  });

  // Use filtered data for rendering
  const days = filteredTimelines.length > 0 ? filteredTimelines[0].days : (timelines.length > 0 ? timelines[0].days : []);
  const months = useMemo(() => groupByMonth(days), [days]);

  // Scroll to today on load
  useEffect(() => {
    if (days.length === 0 || !scrollRef.current) return;
    const today = new Date().toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.date === today);
    if (idx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, idx * CELL_W - 200);
    }
  }, [days]);

  // Today column index
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayIndex = days.findIndex((d) => d.date === todayStr);

  // Summary row: total allocated / available per day (from filtered)
  const summaryDays = useMemo(() => {
    if (filteredTimelines.length === 0) return [];
    return days.map((_, i) => {
      let totalAvail = 0;
      let totalAlloc = 0;
      for (const tl of filteredTimelines) {
        const d = tl.days[i];
        if (d) {
          totalAvail += d.available_hours;
          totalAlloc += d.allocated_hours;
        }
      }
      const remaining = Math.max(totalAvail - totalAlloc, 0);
      const pct = totalAvail > 0 ? Math.round(totalAlloc / totalAvail * 100) : 0;
      return { available: totalAvail, allocated: totalAlloc, remaining, pct };
    });
  }, [filteredTimelines, days]);

  const TYPE_ICONS: Record<string, string> = {
    human: "👤", equipment: "⚙️", material: "📦", cost: "💰",
  };

  const hasFilter = selectedTypes.size > 0 || selectedResources.size > 0;

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>加载时间线数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (timelines.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p className="text-4xl mb-4">📊</p>
        <p className="text-base">暂无资源或分配数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter + Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <PivotFilter
          label="类别"
          items={categoryItems}
          selected={selectedTypes}
          onChange={(s) => { setSelectedTypes(s); setSelectedResources(new Set()); }}
          placeholder="搜索类别..."
        />
        <PivotFilter
          label="资源"
          items={resourceItems}
          selected={selectedResources}
          onChange={setSelectedResources}
          placeholder="搜索姓名、设备..."
        />

        {hasFilter && (
          <button
            onClick={() => { setSelectedTypes(new Set()); setSelectedResources(new Set()); }}
            className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            ✕ 清除筛选
          </button>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-slate-200 dark:border-slate-700" />
            <span>空闲</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-slate-200 dark:border-slate-700" />
            <span>部分</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-800/50 border border-slate-200 dark:border-slate-700" />
            <span>满载</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800/50 border border-slate-200 dark:border-slate-700" />
            <span>超负荷</span>
          </div>
          <button onClick={load}
            className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
            刷新
          </button>
          {days.length > 0 && (
            <span>{days[0].date} ~ {days[days.length - 1].date}</span>
          )}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex">
          {/* Fixed left: resource names */}
          <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 z-10 bg-white dark:bg-slate-800" style={{ width: NAME_W }}>
            {/* Header area */}
            <div className="border-b-2 border-slate-200 dark:border-slate-700">
              <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase" style={{ height: 60 }}>
                资源
              </div>
            </div>
            {/* Resource rows */}
            {filteredTimelines.map((tl) => (
              <div
                key={tl.resource_id}
                className="border-b border-slate-100 dark:border-slate-700/50 flex items-center px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                style={{ height: 44 }}
              >
                <span className="text-base">{TYPE_ICONS[tl.resource_type] || "📦"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{tl.resource_name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{tl.project_name}</div>
                </div>
              </div>
            ))}
            {/* Summary row */}
            <div className="border-t-2 border-slate-200 dark:border-slate-700 flex items-center px-3 bg-slate-50 dark:bg-slate-800/80" style={{ height: 36 }}>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">合计</span>
            </div>
          </div>

          {/* Scrollable right: timeline */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
            <div style={{ width: days.length * CELL_W, minWidth: "100%" }}>
              {/* Month header row 1 */}
              <div className="flex border-b border-slate-200 dark:border-slate-700" style={{ height: 28 }}>
                {months.map((m, mi) => (
                  <div
                    key={mi}
                    className="flex-shrink-0 flex items-center px-2 text-xs font-bold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700"
                    style={{ width: m.days.length * CELL_W }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day header row 2 */}
              <div className="flex border-b border-slate-200 dark:border-slate-700" style={{ height: 32 }}>
                {days.map((d, i) => {
                  const dt = new Date(d.date);
                  const dayNum = dt.getDate();
                  const isToday = d.date === todayStr;
                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 flex flex-col items-center justify-center text-center border-r border-slate-100 dark:border-slate-700/30 ${
                        d.is_weekend
                          ? "bg-slate-100 dark:bg-slate-800/60"
                          : isToday
                          ? "bg-sky-100 dark:bg-sky-900/40"
                          : ""
                      }`}
                      style={{ width: CELL_W }}
                    >
                      <span className={`text-xs leading-none ${
                        isToday ? "font-bold text-sky-600 dark:text-sky-400" : d.is_weekend ? "text-slate-400" : "text-slate-500 dark:text-slate-400"
                      }`}>
                        {d.day_label}
                      </span>
                      <span className={`text-xs leading-none mt-0.5 ${
                        isToday ? "font-bold text-sky-700 dark:text-sky-300" : d.is_weekend ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"
                      }`}>
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Resource rows */}
              {filteredTimelines.map((tl) => (
                <div
                  key={tl.resource_id}
                  className="flex border-b border-slate-100 dark:border-slate-700/50 relative"
                  style={{ height: 44 }}
                >
                  {/* Today vertical line */}
                  {todayIndex >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-sky-500/50 z-10"
                      style={{ left: todayIndex * CELL_W + CELL_W / 2 }}
                    />
                  )}
                  {tl.days.map((d, i) => (
                    <div
                      key={i}
                      className={`flex-shrink-0 flex items-center justify-center border-r border-slate-100/50 dark:border-slate-700/20 cursor-default transition-colors ${cellColor(d.utilization_pct, d.is_weekend)}`}
                      style={{ width: CELL_W }}
                      onMouseEnter={(e) => setTooltip({ day: d, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {!d.is_weekend && (
                        <span className={`text-xs font-medium ${cellTextColor(d.utilization_pct, d.is_weekend)}`}>
                          {d.remaining_hours > 0 ? d.remaining_hours.toFixed(0) : d.allocated_hours > d.available_hours ? `${d.allocated_hours.toFixed(0)}` : "0"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Summary row */}
              <div className="flex border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80" style={{ height: 36 }}>
                {summaryDays.map((s, i) => {
                  const d = days[i];
                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 flex items-center justify-center border-r border-slate-100/50 dark:border-slate-700/20 ${
                        d?.is_weekend ? "bg-slate-100 dark:bg-slate-800/60" : ""
                      }`}
                      style={{ width: CELL_W }}
                      onMouseEnter={(e) => d && setTooltip({ day: { ...d, available_hours: s.available, allocated_hours: s.allocated, remaining_hours: s.remaining, utilization_pct: s.pct }, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {!d?.is_weekend && (
                        <span className={`text-xs font-bold ${
                          s.pct > 100 ? "text-red-500" : s.pct > 0 ? "text-sky-600 dark:text-sky-400" : "text-slate-400"
                        }`}>
                          {s.remaining > 0 ? `${s.remaining.toFixed(0)}` : "0"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <Tooltip day={tooltip.day} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
