"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  projects, resources as resApi, gantt,
  type ProjectExt, type Resource, type Allocation, type GanttTask,
  type ResourceSummary,
} from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import ResourceTimelineView from "@/components/ResourceTimelineView";
import PivotFilter, { type PivotFilterItem } from "@/components/PivotFilter";
import {
  InlineEditText, InlineEditNumber, InlineEditSelect,
} from "@/components/InlineEdit";

const TYPE_LABELS: Record<string, string> = {
  human: "人力", equipment: "设备", material: "材料", cost: "费用",
};
const TYPE_COLORS: Record<string, string> = {
  human: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
  equipment: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  material: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  cost: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
};

/* ================================================================== */
/*  View Tabs                                                         */
/* ================================================================== */

type ViewTab = "project" | "resource" | "timeline";

function ViewTabs({ active, onChange }: { active: ViewTab; onChange: (v: ViewTab) => void }) {
  const tabs: { key: ViewTab; label: string; icon: string }[] = [
    { key: "project", label: "项目视角", icon: "📋" },
    { key: "resource", label: "资源视角", icon: "👤" },
    { key: "timeline", label: "时间线", icon: "📊" },
  ];
  return (
    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 gap-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === t.key
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Utilization bar                                                    */
/* ================================================================== */

function UtilBar({ pct, max }: { pct: number; max: number }) {
  const over = pct > 100;
  const color = over
    ? "bg-red-500"
    : pct >= 80
    ? "bg-amber-500"
    : pct > 0
    ? "bg-emerald-500"
    : "bg-slate-300 dark:bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-12 text-right ${over ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/* ================================================================== */
/*  PROJECT VIEW (original)                                           */
/* ================================================================== */

function ProjectView({
  projectList, selectedProject, setSelectedProject,
}: {
  projectList: ProjectExt[];
  selectedProject: string;
  setSelectedProject: (v: string) => void;
}) {
  const [resourceList, setResourceList] = useState<Resource[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add resource form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("human");
  const [newRate, setNewRate] = useState("0");
  const [newGroup, setNewGroup] = useState("");

  // Add allocation form
  const [showAllocForm, setShowAllocForm] = useState(false);
  const [allocResId, setAllocResId] = useState("");
  const [allocTaskId, setAllocTaskId] = useState("");
  const [allocUnits, setAllocUnits] = useState("1.0");

  const loadData = async (pid: string) => {
    setLoading(true);
    setError("");
    try {
      const [res, alloc, ganttData] = await Promise.all([
        resApi.list(pid),
        resApi.listAllocations(pid),
        gantt.getData(pid),
      ]);
      setResourceList(res);
      setAllocations(alloc);
      setTasks(ganttData.tasks);
    } catch (e: unknown) {
      setError((e as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProject) {
      setResourceList([]);
      setAllocations([]);
      setTasks([]);
      return;
    }
    loadData(selectedProject);
  }, [selectedProject]);

  const handleSaveResource = async (id: string, data: Partial<Resource>) => {
    if (!selectedProject) return;
    try {
      await resApi.update(selectedProject, id, data);
      setResourceList(await resApi.list(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "保存失败");
    }
  };

  const handleAddResource = async () => {
    if (!newName.trim() || !selectedProject) return;
    try {
      await resApi.create(selectedProject, {
        project_ext_id: selectedProject,
        name: newName.trim(),
        resource_type: newType,
        standard_rate: parseFloat(newRate) || 0,
        group_name: newGroup.trim() || undefined,
      });
      setNewName("");
      setNewRate("0");
      setNewGroup("");
      setShowAddForm(false);
      setResourceList(await resApi.list(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "添加失败");
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (!selectedProject || !confirm("确认删除此资源？")) return;
    try {
      await resApi.delete(selectedProject, id);
      setResourceList(await resApi.list(selectedProject));
      setAllocations(await resApi.listAllocations(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "删除失败");
    }
  };

  const handleAddAllocation = async () => {
    if (!allocResId || !allocTaskId || !selectedProject) return;
    try {
      await resApi.createAllocation(selectedProject, {
        resource_id: allocResId,
        workitem_ext_id: allocTaskId,
        units: parseFloat(allocUnits) || 1,
      });
      setShowAllocForm(false);
      setAllocResId("");
      setAllocTaskId("");
      setAllocUnits("1.0");
      setAllocations(await resApi.listAllocations(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "分配失败");
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!selectedProject) return;
    try {
      await resApi.deleteAllocation(selectedProject, id);
      setAllocations(await resApi.listAllocations(selectedProject));
    } catch (e: unknown) {
      setError((e as Error).message || "删除失败");
    }
  };

  const taskName = (id: string) => tasks.find((t) => t.id === id)?.name || id.slice(0, 8);
  const resName = (id: string) => resourceList.find((r) => r.id === id)?.name || id.slice(0, 8);

  const utilizationMap = new Map<string, number>();
  for (const a of allocations) {
    utilizationMap.set(a.resource_id, (utilizationMap.get(a.resource_id) || 0) + a.units);
  }

  return (
    <div className="space-y-4">
      {/* Project selector */}
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
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <p className="text-4xl mb-4">👥</p>
          <p className="text-base">请先选择一个项目</p>
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p>加载中...</p>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ---- Resource Pool ---- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                资源池
                <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">({resourceList.length})</span>
              </h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {showAddForm ? "取消" : "+ 添加资源"}
              </button>
            </div>

            {showAddForm && (
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <input placeholder="资源名称 *" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <select value={newType} onChange={(e) => setNewType(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                    <option value="human">人力</option>
                    <option value="equipment">设备</option>
                    <option value="material">材料</option>
                    <option value="cost">费用</option>
                  </select>
                  <input type="number" placeholder="标准费率" value={newRate} onChange={(e) => setNewRate(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <input placeholder="分组" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <button onClick={handleAddResource}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    确认添加
                  </button>
                </div>
              </div>
            )}

            {resourceList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <p className="text-sm">暂无资源，点击"添加资源"开始</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">名称</th>
                      <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">类型</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">标准费率</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">最大单位</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">已分配</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">分组</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceList.map((r) => {
                      const used = utilizationMap.get(r.id) || 0;
                      const pct = Math.round((used / r.max_units) * 100);
                      const over = pct > 100;
                      return (
                        <tr key={r.id} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${over ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1">
                              <InlineEditText value={r.name} onSave={(v) => handleSaveResource(r.id, { name: v })} />
                              {over && <span className="text-xs text-red-500 font-medium whitespace-nowrap">超负荷</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <InlineEditSelect value={r.resource_type}
                              options={[
                                { value: "human", label: "人力" },
                                { value: "equipment", label: "设备" },
                                { value: "material", label: "材料" },
                                { value: "cost", label: "费用" },
                              ]}
                              onSave={(v) => handleSaveResource(r.id, { resource_type: v })}
                            />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <InlineEditNumber value={r.standard_rate} min={0} step={10} suffix="/h" onSave={(v) => handleSaveResource(r.id, { standard_rate: v })} />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <InlineEditNumber value={Math.round(r.max_units * 100)} min={0} max={1000} step={10} suffix="%" onSave={(v) => handleSaveResource(r.id, { max_units: v / 100 })} />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`font-medium ${over ? "text-red-500" : used > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                              {pct}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <InlineEditText value={r.group_name || ""} onSave={(v) => handleSaveResource(r.id, { group_name: v || null })} placeholder="—" />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button onClick={() => handleDeleteResource(r.id)}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-medium transition-colors">
                              删除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- Allocations ---- */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                资源分配
                <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">({allocations.length})</span>
              </h2>
              <button onClick={() => setShowAllocForm(!showAllocForm)}
                disabled={resourceList.length === 0 || tasks.length === 0}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {showAllocForm ? "取消" : "+ 添加分配"}
              </button>
            </div>

            {showAllocForm && (
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select value={allocResId} onChange={(e) => setAllocResId(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                    <option value="">选择资源...</option>
                    {resourceList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <select value={allocTaskId} onChange={(e) => setAllocTaskId(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                    <option value="">选择任务...</option>
                    {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="number" min="0" max="1" step="0.1" placeholder="分配比例 (0-1)" value={allocUnits}
                    onChange={(e) => setAllocUnits(e.target.value)}
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                  <button onClick={handleAddAllocation}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    确认分配
                  </button>
                </div>
              </div>
            )}

            {allocations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <p className="text-sm">暂无分配记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">资源</th>
                      <th className="py-2.5 px-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">任务</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">分配比例</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">计划工时</th>
                      <th className="py-2.5 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{resName(a.resource_id)}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{taskName(a.workitem_ext_id)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{Math.round(a.units * 100)}%</td>
                        <td className="py-2.5 px-4 text-center text-slate-600 dark:text-slate-300">{a.work_hours ? `${a.work_hours}h` : "—"}</td>
                        <td className="py-2.5 px-4 text-center">
                          <button onClick={() => handleDeleteAllocation(a.id)}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-medium transition-colors">
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  RESOURCE VIEW (cross-project)                                     */
/* ================================================================== */

function ResourceView() {
  const [summaries, setSummaries] = useState<ResourceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOveralloc, setFilterOveralloc] = useState(false);

  // Two-level PivotFilter state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const TYPE_MAP: Record<string, { label: string; icon: string }> = {
    human: { label: "人力", icon: "👤" },
    equipment: { label: "设备", icon: "⚙️" },
    material: { label: "材料", icon: "📦" },
    cost: { label: "费用", icon: "💰" },
  };

  // Build category filter items from summaries
  const categoryItems: PivotFilterItem[] = Object.entries(TYPE_MAP).map(([key, val]) => ({
    id: key,
    label: `${val.icon} ${val.label}`,
    badge: summaries.filter((r) => r.resource_type === key).length,
  }));

  // Build resource filter items (filtered by selected types if any)
  const resourceItems: PivotFilterItem[] = summaries
    .filter((r) => selectedTypes.size === 0 || selectedTypes.has(r.resource_type))
    .map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: TYPE_MAP[r.resource_type]?.label || r.resource_type,
      badge: `${Math.round(r.utilization_pct)}%`,
      badgeColor: r.utilization_pct > 100
        ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
        : r.utilization_pct >= 80
        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
    }));

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedItems(new Set());
    setFilterOveralloc(false);
  };

  const hasFilter = selectedTypes.size > 0 || selectedItems.size > 0 || filterOveralloc;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setSummaries(await resApi.crossProjectSummary());
    } catch (e: unknown) {
      setError((e as Error).message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter logic
  let filtered = summaries;
  if (selectedTypes.size > 0) {
    filtered = filtered.filter((r) => selectedTypes.has(r.resource_type));
  }
  if (selectedItems.size > 0) {
    filtered = filtered.filter((r) => selectedItems.has(r.id));
  }
  if (filterOveralloc) {
    filtered = filtered.filter((r) => r.utilization_pct > 100);
  }

  // Group by type
  const GROUP_ORDER = ["human", "equipment", "material", "cost"];
  const GROUP_ICONS: Record<string, string> = { human: "👤", equipment: "⚙️", material: "📦", cost: "💰" };
  const grouped = new Map<string, ResourceSummary[]>();
  for (const r of filtered) {
    const list = grouped.get(r.resource_type) || [];
    list.push(r);
    grouped.set(r.resource_type, list);
  }
  // Sort by GROUP_ORDER, unknown types at end
  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a[0]);
    const bi = GROUP_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Stats
  const totalResources = summaries.length;
  const overallocated = summaries.filter((r) => r.utilization_pct > 100).length;
  const fullyUsed = summaries.filter((r) => r.utilization_pct >= 100 && r.utilization_pct <= 100).length;
  const available = summaries.filter((r) => r.remaining > 0).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalResources}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">全部资源</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{available}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">有剩余产能</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-sky-200 dark:border-sky-800 p-4">
          <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{fullyUsed}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">已满载 (100%)</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <div className="text-2xl font-bold text-red-500">{overallocated}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">超负荷 (&gt;100%)</div>
        </div>
      </div>

      {/* Filter bar: PivotFilter dropdowns + chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <PivotFilter
          label="类别"
          items={categoryItems}
          selected={selectedTypes}
          onChange={(s) => { setSelectedTypes(s); setSelectedItems(new Set()); }}
          placeholder="搜索类别..."
        />
        <PivotFilter
          label="资源"
          items={resourceItems}
          selected={selectedItems}
          onChange={setSelectedItems}
          placeholder="搜索姓名、设备..."
        />
        <button
          onClick={() => setFilterOveralloc(!filterOveralloc)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            filterOveralloc
              ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-600"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300"
          }`}
        >
          {filterOveralloc ? "⚠️" : "🔻"} 超负荷
        </button>

        {hasFilter && (
          <div className="flex items-center gap-1.5 flex-wrap ml-1">
            {[...selectedTypes].map((t) => {
              const info = TYPE_MAP[t];
              return (
                <span key={t}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                  {info?.icon} {info?.label}
                </span>
              );
            })}
            {selectedItems.size > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                + {selectedItems.size} 项资源
              </span>
            )}
            <button onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
              ✕ 清除
            </button>
          </div>
        )}

        <button onClick={load}
          className="ml-auto bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p>加载中...</p>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-base">没有符合条件的资源</p>
        </div>
      ) : (
        /* Grouped resource cards */
        <div className="space-y-6">
          {sortedGroups.map(([type, items]) => {
            const isCollapsed = collapsedGroups.has(type);
            const groupOver = items.filter((r) => r.utilization_pct > 100).length;
            const groupAvail = items.filter((r) => r.remaining > 0).length;
            const avgUtil = items.length > 0
              ? Math.round(items.reduce((s, r) => s + r.utilization_pct, 0) / items.length)
              : 0;
            return (
              <div key={type}>
                {/* Group header */}
                <div
                  className="flex items-center gap-3 mb-3 cursor-pointer select-none group"
                  onClick={() => toggleGroup(type)}
                >
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-lg">{GROUP_ICONS[type] || "📦"}</span>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {TYPE_LABELS[type] || type}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[type]}`}>
                    {items.length} 个
                  </span>
                  {/* Group stats */}
                  <div className="flex items-center gap-3 ml-auto text-xs text-slate-500 dark:text-slate-400">
                    {groupAvail > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">空闲 {groupAvail}</span>
                    )}
                    {groupOver > 0 && (
                      <span className="text-red-500">超负荷 {groupOver}</span>
                    )}
                    <span>平均利用率 {avgUtil}%</span>
                  </div>
                </div>

                {/* Group cards */}
                {!isCollapsed && (
                  <div className="space-y-2 pl-1">
                    {items.map((r) => {
                      const isOpen = expandedId === r.id;
                      const over = r.utilization_pct > 100;
                      return (
                        <div
                          key={r.id}
                          className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all ${
                            over
                              ? "border-red-300 dark:border-red-700"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {/* Card header */}
                          <div
                            className="px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                            onClick={() => setExpandedId(isOpen ? null : r.id)}
                          >
                            <svg
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white truncate">{r.name}</span>
                                {over && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
                                    超负荷
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {r.project_name}
                                {r.group_name && <span className="ml-2 text-slate-400 dark:text-slate-500">· {r.group_name}</span>}
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0 hidden sm:block">
                              <div className="text-sm text-slate-600 dark:text-slate-300">¥{r.standard_rate}/h</div>
                            </div>

                            <div className="flex-shrink-0 w-32">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                                <span>{r.total_allocated.toFixed(1)} / {r.max_units.toFixed(1)}</span>
                              </div>
                              <UtilBar pct={r.utilization_pct} max={r.max_units} />
                            </div>

                            <div className="flex-shrink-0 text-right w-16">
                              <div className={`text-sm font-bold ${r.remaining > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                剩 {r.remaining.toFixed(1)}
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">可用</div>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4 bg-slate-50 dark:bg-slate-900/50">
                              {r.allocations.length === 0 ? (
                                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                                  此资源尚未被分配到任何任务
                                </p>
                              ) : (
                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                                    分配详情 ({r.allocations.length} 项)
                                  </h4>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400">项目</th>
                                        <th className="py-2 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400">任务</th>
                                        <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">分配比例</th>
                                        <th className="py-2 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">工时</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.allocations.map((a) => (
                                        <tr key={a.alloc_id} className="border-b border-slate-100 dark:border-slate-700/50">
                                          <td className="py-2 px-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                              {a.project_name}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{a.task_name}</td>
                                          <td className="py-2 px-3 text-center">
                                            <span className={`font-medium ${a.units >= 1 ? "text-sky-600 dark:text-sky-400" : "text-slate-500"}`}>
                                              {Math.round(a.units * 100)}%
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400">
                                            {a.work_hours ? `${a.work_hours}h` : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                                    <span>总分配: <b className="text-slate-700 dark:text-slate-200">{r.total_allocated.toFixed(1)}</b></span>
                                    <span>最大: <b className="text-slate-700 dark:text-slate-200">{r.max_units.toFixed(1)}</b></span>
                                    <span>剩余: <b className={r.remaining > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>{r.remaining.toFixed(1)}</b></span>
                                    <span>利用率: <b className={over ? "text-red-500" : "text-sky-600 dark:text-sky-400"}>{r.utilization_pct.toFixed(0)}%</b></span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN PAGE                                                          */
/* ================================================================== */

export default function ResourcesPage() {
  const [projectList, setProjectList] = useState<ProjectExt[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [view, setView] = useState<ViewTab>("project");

  useEffect(() => {
    projects.list().then(setProjectList).catch(console.error);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">
            ← 首页
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">资源管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <ViewTabs active={view} onChange={setView} />
          <ThemeToggle />
        </div>
      </header>

      <div className="p-6">
        {view === "project" ? (
          <ProjectView
            projectList={projectList}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
          />
        ) : view === "resource" ? (
          <ResourceView />
        ) : (
          <ResourceTimelineView />
        )}
      </div>
    </main>
  );
}
