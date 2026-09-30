"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface PivotFilterItem {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string | number;
  badgeColor?: string;
}

interface Props {
  label: string;
  icon?: string;
  items: PivotFilterItem[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  maxHeight?: number;
  placeholder?: string;
}

export default function PivotFilter({
  label,
  icon,
  items,
  selected,
  onChange,
  maxHeight = 280,
  placeholder = "搜索...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Filtered items by search
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.sublabel?.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
    );
  }, [items, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const noneFilteredSelected = filtered.every((i) => !selected.has(i.id));

  const selectAllFiltered = () => {
    const next = new Set(selected);
    for (const i of filtered) next.add(i.id);
    onChange(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selected);
    for (const i of filtered) next.delete(i.id);
    onChange(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const isActive = selected.size > 0;

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
          open || isActive
            ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-600"
            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
        }`}
      >
        {icon && <span className="text-base">{icon}</span>}
        <span>{label}</span>
        {isActive && (
          <span className="bg-sky-500 text-white text-xs min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-bold">
            {selected.size}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
          style={{ minWidth: 260, maxWidth: 340 }}
        >
          {/* Search bar */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 dark:focus:ring-sky-500"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select all / deselect all */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700/50">
            <button
              onClick={selectAllFiltered}
              disabled={allFilteredSelected}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                allFilteredSelected
                  ? "text-slate-300 dark:text-slate-600 cursor-default"
                  : "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30"
              }`}
            >
              全选
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={deselectAllFiltered}
              disabled={noneFilteredSelected}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                noneFilteredSelected
                  ? "text-slate-300 dark:text-slate-600 cursor-default"
                  : "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30"
              }`}
            >
              全不选
            </button>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              {selected.size}/{items.length} 已选
            </span>
          </div>

          {/* Scrollable checkbox list */}
          <div className="overflow-y-auto py-1" style={{ maxHeight }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                无匹配项
              </div>
            ) : (
              filtered.map((item) => {
                const isChecked = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      isChecked ? "bg-sky-50/50 dark:bg-sky-900/20" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked
                        ? "bg-sky-500 border-sky-500 dark:bg-sky-600 dark:border-sky-600"
                        : "border-slate-300 dark:border-slate-500"
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>

                    {/* Label */}
                    <span className={`flex-1 text-sm truncate ${
                      isChecked
                        ? "text-slate-900 dark:text-white font-medium"
                        : "text-slate-600 dark:text-slate-300"
                    }`}>
                      {item.label}
                    </span>

                    {/* Sublabel */}
                    {item.sublabel && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                        {item.sublabel}
                      </span>
                    )}

                    {/* Badge */}
                    {item.badge !== undefined && item.badge !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        item.badgeColor || "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {selected.size > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 px-2 py-1.5 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                已选 {selected.size} 项
              </span>
              <button
                onClick={() => onChange(new Set())}
                className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
              >
                清除全部
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
