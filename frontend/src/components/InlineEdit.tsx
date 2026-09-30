"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

/* ---------- InlineEditText ---------- */

export function InlineEditText({
  value,
  onSave,
  className = "",
  placeholder = "—",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <input
        ref={ref}
        className={`border border-sky-400 dark:border-sky-500 rounded px-1.5 py-0.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); if (draft !== value) onSave(draft); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className={`cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded px-1.5 py-0.5 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="点击编辑"
    >
      {value || <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>}
    </span>
  );
}

/* ---------- InlineEditNumber ---------- */

export function InlineEditNumber({
  value,
  onSave,
  min,
  max,
  step = 1,
  suffix = "",
  className = "",
}: {
  value: number;
  onSave: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    setEditing(false);
    if (!isNaN(n) && n !== value) {
      let clamped = n;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onSave(clamped);
    } else {
      setDraft(String(value));
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        className={`border border-sky-400 dark:border-sky-500 rounded px-1.5 py-0.5 text-sm text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none w-20 ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className={`cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded px-1.5 py-0.5 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="点击编辑"
    >
      {value}{suffix}
    </span>
  );
}

/* ---------- InlineEditDate ---------- */

export function InlineEditDate({
  value,
  onSave,
  className = "",
}: {
  value: string; // "YYYY-MM-DD" or ""
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        className={`border border-sky-400 dark:border-sky-500 rounded px-1.5 py-0.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className={`cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded px-1.5 py-0.5 font-mono transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="点击编辑"
    >
      {value ? value.slice(5) : <span className="text-slate-400">—</span>}
    </span>
  );
}

/* ---------- InlineEditSelect ---------- */

export function InlineEditSelect({
  value,
  options,
  onSave,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <select
        ref={ref}
        className={`border border-sky-400 dark:border-sky-500 rounded px-1.5 py-0.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none ${className}`}
        defaultValue={value}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  const currentLabel = options.find((o) => o.value === value)?.label || value;
  return (
    <span
      className={`cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded px-1.5 py-0.5 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="点击编辑"
    >
      {currentLabel || <span className="text-slate-400">—</span>}
    </span>
  );
}

/* ---------- InlineEditToggle ---------- */

export function InlineEditToggle({
  value,
  onSave,
  labelOn = "✓",
  labelOff = "✗",
  className = "",
}: {
  value: boolean;
  onSave: (v: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  className?: string;
}) {
  return (
    <button
      className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${
        value
          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
      } ${className}`}
      onClick={() => onSave(!value)}
      title="点击切换"
    >
      {value ? labelOn : labelOff}
    </button>
  );
}
