"use client";

import { useState } from "react";
import type { WBNode, WorkitemUpdate } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import {
  InlineEditNumber, InlineEditDate, InlineEditToggle,
} from "./InlineEdit";

/* ---------- helpers ---------- */

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.slice(5, 10); // MM-DD
}

function pctBar(pct: number) {
  const p = Math.round(pct * 100);
  const color =
    p >= 100 ? "bg-emerald-500" : p > 50 ? "bg-sky-500" : p > 0 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{p}%</span>
    </div>
  );
}

/* ---------- Row ---------- */

function WBSRow({
  node,
  depth,
  expanded,
  toggleExpand,
  editable,
  onSave,
}: {
  node: WBNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  editable: boolean;
  onSave?: (nodeId: string, data: WorkitemUpdate) => void;
}) {
  const { t } = useLang();
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  const save = (data: WorkitemUpdate) => {
    if (onSave) onSave(node.id, data);
  };

  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
          node.is_critical ? "bg-red-50/50 dark:bg-red-900/10" : ""
        }`}
      >
        {/* WBS Code */}
        <td className="py-2.5 px-3 text-sm font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {node.wbs_code || "—"}
        </td>

        {/* Name (with indent + expand toggle) */}
        <td className="py-2.5 px-3 text-sm">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 24 }}>
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-5" />
            )}
            {node.is_milestone && <span className="text-amber-500 text-base" title={t("wbs.tooltipMilestone")}>◆</span>}
            {node.is_critical && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={t("wbs.tooltipCritical")} />}
            <span
              className={`font-medium ${
                node.is_critical
                  ? "text-red-700 dark:text-red-400"
                  : "text-slate-800 dark:text-slate-200"
              }`}
              title={node.name}
            >
              {node.name}
            </span>
          </div>
        </td>

        {/* Duration */}
        <td className="py-2.5 px-3 text-sm text-center whitespace-nowrap">
          {editable ? (
            <InlineEditNumber value={node.duration_days} min={0} step={1} suffix="d" onSave={(v) => save({ duration_days: v })} />
          ) : (
            <span className="text-slate-600 dark:text-slate-300">{node.duration_days > 0 ? `${node.duration_days}d` : "—"}</span>
          )}
        </td>

        {/* Start */}
        <td className="py-2.5 px-3 text-sm text-center whitespace-nowrap font-mono">
          {editable ? (
            <InlineEditDate value={node.start_date || ""} onSave={(v) => save({ constraint_type: "SNET", constraint_date: v })} />
          ) : (
            <span className="text-slate-500 dark:text-slate-400">{fmtDate(node.start_date)}</span>
          )}
        </td>

        {/* End */}
        <td className="py-2.5 px-3 text-sm text-center whitespace-nowrap font-mono">
          <span className="text-slate-500 dark:text-slate-400">{fmtDate(node.end_date)}</span>
        </td>

        {/* Progress */}
        <td className="py-2.5 px-3">
          {editable ? (
            <InlineEditNumber
              value={Math.round(node.percent_complete * 100)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              onSave={(v) => save({ percent_complete: v / 100 })}
            />
          ) : (
            pctBar(node.percent_complete)
          )}
        </td>

        {/* Milestone */}
        <td className="py-2.5 px-3 text-center">
          {editable ? (
            <InlineEditToggle
              value={node.is_milestone}
              onSave={(v) => save({ is_milestone: v })}
              labelOn="◆"
              labelOff="—"
            />
          ) : (
            <span className="text-slate-400">{node.is_milestone ? "◆" : "—"}</span>
          )}
        </td>

        {/* Float */}
        <td className="py-2.5 px-3 text-center text-xs font-mono">
          {node.total_float !== null && node.total_float !== undefined ? (
            <span className={node.total_float <= 0 ? "text-red-500 font-bold" : "text-emerald-600 dark:text-emerald-400"}>
              {typeof node.total_float === "number" ? node.total_float.toFixed(0) : "—"}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        {/* State */}
        <td className="py-2.5 px-3 text-sm text-center whitespace-nowrap">
          {node.state ? (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              node.state === "completed"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : node.state === "started"
                ? "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {node.state === "completed" ? t("wbs.statusCompleted") : node.state === "started" ? t("wbs.statusStarted") : node.state === "unstarted" ? t("wbs.statusUnstarted") : node.state}
            </span>
          ) : "—"}
        </td>
      </tr>

      {/* Children (recursive) */}
      {isOpen &&
        node.children.map((child) => (
          <WBSRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpand={toggleExpand}
            editable={editable}
            onSave={onSave}
          />
        ))}
    </>
  );
}

/* ---------- Main Component ---------- */

export default function WBSTree({
  tree,
  editable = false,
  onSave,
}: {
  tree: WBNode[];
  editable?: boolean;
  onSave?: (nodeId: string, data: WorkitemUpdate) => void;
}) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand all top-level by default
    return new Set(tree.map((n) => n.id));
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const walk = (nodes: WBNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          allIds.add(n.id);
          walk(n.children);
        }
      }
    };
    walk(tree);
    setExpanded(allIds);
  };

  const collapseAll = () => setExpanded(new Set());

  // Stats
  const countNodes = (nodes: WBNode[]): number =>
    nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
  const countCritical = (nodes: WBNode[]): number =>
    nodes.reduce((acc, n) => acc + (n.is_critical ? 1 : 0) + countCritical(n.children), 0);
  const totalTasks = countNodes(tree);
  const criticalTasks = countCritical(tree);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={expandAll}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {t("wbs.expandAll")}
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {t("wbs.collapseAll")}
        </button>
        {editable && (
          <span className="text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2 py-1 rounded-md">
            {t("wbs.editMode")}
          </span>
        )}
        <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
          {t("wbs.totalItems")} <span className="font-semibold text-slate-700 dark:text-slate-200">{totalTasks}</span> {t("wbs.itemsUnit")}
          {criticalTasks > 0 && (
            <> · {t("wbs.criticalItems")} <span className="font-semibold text-red-500">{criticalTasks}</span> {t("wbs.itemsUnit")}</>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
              <th className="py-2.5 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">{t("wbs.thWBS")}</th>
              <th className="py-2.5 px-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("wbs.thTaskName")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">{t("wbs.thDuration")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28">{t("wbs.thStart")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">{t("wbs.thEnd")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">{t("wbs.thProgress")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">{t("wbs.thMilestone")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-14">{t("wbs.thFloat")}</th>
              <th className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">{t("wbs.thStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((node) => (
              <WBSRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
                editable={editable}
                onSave={onSave}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
