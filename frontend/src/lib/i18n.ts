"use client";

import { createContext, useContext } from "react";

export type Lang = "zh" | "en";

const dict: Record<string, Record<Lang, string>> = {
  // ── Common ──
  "common.home":              { zh: "首页",           en: "Home" },
  "common.selectProject":     { zh: "选择项目...",     en: "Select Project..." },
  "common.syncFromPlane":     { zh: "从 Plane 同步",   en: "Sync from Plane" },
  "common.syncing":           { zh: "同步中...",       en: "Syncing..." },
  "common.refresh":           { zh: "刷新",           en: "Refresh" },
  "common.refreshCPM":        { zh: "刷新 CPM",       en: "Refresh CPM" },
  "common.loading":           { zh: "加载中...",       en: "Loading..." },
  "common.delete":            { zh: "删除",           en: "Delete" },
  "common.add":               { zh: "+ 添加",         en: "+ Add" },
  "common.save":              { zh: "保存",           en: "Save" },
  "common.cancel":            { zh: "取消",           en: "Cancel" },
  "common.edit":              { zh: "编辑",           en: "Edit" },
  "common.confirm":           { zh: "确认",           en: "Confirm" },
  "common.close":             { zh: "关闭",           en: "Close" },
  "common.create":            { zh: "创建",           en: "Create" },
  "common.clickToEdit":       { zh: "点击编辑",       en: "Click to edit" },
  "common.clickToToggle":     { zh: "点击切换",       en: "Click to toggle" },
  "common.noData":            { zh: "暂无数据",       en: "No data" },
  "common.confirmDelete":     { zh: "确认删除此资源？", en: "Confirm delete this resource?" },

  // ── Navigation / Homepage ──
  "nav.gantt":       { zh: "甘特图 & 关键路径", en: "Gantt & Critical Path" },
  "nav.ganttDesc":   { zh: "CPM 关键路径、依赖关系、里程碑", en: "CPM critical path, dependencies, milestones" },
  "nav.wbs":         { zh: "WBS 工作分解",      en: "WBS Work Breakdown" },
  "nav.wbsDesc":     { zh: "树形结构、自动编号、层级管理", en: "Tree structure, auto-numbering, hierarchy" },
  "nav.resources":   { zh: "资源管理",           en: "Resources" },
  "nav.resourcesDesc": { zh: "资源池、分配、费率、负荷分析", en: "Resource pool, allocation, rates, load analysis" },
  "nav.evm":         { zh: "挣值分析 EVM",       en: "Earned Value (EVM)" },
  "nav.evmDesc":     { zh: "SPI/CPI/EAC、S曲线、趋势预测", en: "SPI/CPI/EAC, S-curve, trend forecasting" },
  "nav.mta":         { zh: "里程碑趋势分析 MTA",   en: "Milestone Trend (MTA)" },
  "nav.mtaDesc":     { zh: "里程碑日期漂移追踪、偏差分析", en: "Milestone date drift tracking, variance analysis" },
  "nav.subtitle":    { zh: "ProjectLibre 级别专业项目管理功能 — 运行于 Plane 之上", en: "ProjectLibre-grade professional PM features — powered by Plane" },
  "nav.apiDocs":     { zh: "API 文档",           en: "API Docs" },

  // ── Theme ──
  "theme.light": { zh: "亮色", en: "Light" },
  "theme.dark":  { zh: "暗色", en: "Dark" },
  "theme.switchToLight": { zh: "切换到亮色模式", en: "Switch to light mode" },
  "theme.switchToDark":  { zh: "切换到暗色模式", en: "Switch to dark mode" },

  // ── Gantt Page ──
  "gantt.title":             { zh: "甘特图 & 关键路径", en: "Gantt & Critical Path" },
  "gantt.selectProjectHint": { zh: "请先选择一个项目，然后查看甘特图", en: "Select a project to view the Gantt chart" },
  "gantt.tabChart":          { zh: "甘特图",           en: "Gantt Chart" },
  "gantt.tabTable":          { zh: "编辑表格",         en: "Edit Table" },
  "gantt.tableHint":         { zh: "点击单元格数值即可编辑 · 按 Enter 确认 · 按 Esc 取消 · 修改后自动刷新 CPM", en: "Click cell value to edit · Enter to confirm · Esc to cancel · Auto-refresh CPM" },

  // Gantt table headers
  "gantt.thTaskName":  { zh: "任务名称", en: "Task Name" },
  "gantt.thDuration":  { zh: "工期",     en: "Duration" },
  "gantt.thStart":     { zh: "开始",     en: "Start" },
  "gantt.thEnd":       { zh: "结束",     en: "End" },
  "gantt.thProgress":  { zh: "进度%",    en: "Progress%" },
  "gantt.thMilestone": { zh: "里程碑",   en: "Milestone" },
  "gantt.thCost":      { zh: "成本",     en: "Cost" },
  "gantt.thFloat":     { zh: "浮动",     en: "Float" },

  // Gantt dependencies
  "gantt.dependencies":   { zh: "依赖关系",     en: "Dependencies" },
  "gantt.predecessor":    { zh: "前置任务...",   en: "Predecessor..." },
  "gantt.successor":      { zh: "后继任务...",   en: "Successor..." },

  // Gantt project settings
  "gantt.projectSettings":   { zh: "项目设置",               en: "Project Settings" },
  "gantt.budget":            { zh: "预算 (¥)",               en: "Budget (¥)" },
  "gantt.workHoursPerDay":   { zh: "每日工时 (h)",            en: "Work Hours/Day" },
  "gantt.workDaysPerWeek":   { zh: "每周工作天数",            en: "Work Days/Week" },
  "gantt.currency":          { zh: "货币",                   en: "Currency" },

  // Gantt chart component
  "gantt.workDays":         { zh: "工作日",     en: "work days" },
  "gantt.tasks":            { zh: "个任务",     en: "tasks" },
  "gantt.criticalTasks":    { zh: "个关键任务", en: "critical tasks" },
  "gantt.normalTask":       { zh: "普通任务",   en: "Normal Task" },
  "gantt.criticalPath":     { zh: "关键路径",   en: "Critical Path" },
  "gantt.milestone":        { zh: "里程碑",     en: "Milestone" },
  "gantt.completed":        { zh: "已完成",     en: "Completed" },
  "gantt.today":            { zh: "今天",       en: "Today" },
  "gantt.noTaskData":       { zh: "暂无任务数据", en: "No task data" },
  "gantt.floatLabel":       { zh: "浮动",       en: "Float" },

  // Weekdays
  "gantt.weekday.sun": { zh: "日", en: "Su" },
  "gantt.weekday.mon": { zh: "一", en: "Mo" },
  "gantt.weekday.tue": { zh: "二", en: "Tu" },
  "gantt.weekday.wed": { zh: "三", en: "We" },
  "gantt.weekday.thu": { zh: "四", en: "Th" },
  "gantt.weekday.fri": { zh: "五", en: "Fr" },
  "gantt.weekday.sat": { zh: "六", en: "Sa" },

  // ── WBS Page ──
  "wbs.title":            { zh: "WBS 工作分解结构", en: "WBS Work Breakdown Structure" },
  "wbs.selectProjectHint": { zh: "请先选择一个项目，然后查看 WBS", en: "Select a project to view the WBS" },
  "wbs.lockEdit":         { zh: "🔒 锁定编辑",     en: "🔒 Lock Editing" },
  "wbs.unlockEdit":       { zh: "✏️ 开启编辑",     en: "✏️ Enable Editing" },
  "wbs.noWorkitems":      { zh: "暂无工作项数据",   en: "No work item data" },
  "wbs.syncFirst":        { zh: "请先从 Plane 同步工作项", en: "Please sync work items from Plane first" },

  // WBS Tree component
  "wbs.expandAll":   { zh: "全部展开", en: "Expand All" },
  "wbs.collapseAll": { zh: "全部折叠", en: "Collapse All" },
  "wbs.editMode":    { zh: "编辑模式：点击数值即可修改", en: "Edit mode: click values to edit" },
  "wbs.totalItems":  { zh: "共",       en: "Total" },
  "wbs.criticalItems": { zh: "关键",   en: "Critical" },
  "wbs.itemsUnit":   { zh: "项",       en: "items" },
  "wbs.thWBS":       { zh: "WBS",      en: "WBS" },
  "wbs.thTaskName":  { zh: "任务名称", en: "Task Name" },
  "wbs.thDuration":  { zh: "工期",     en: "Duration" },
  "wbs.thStart":     { zh: "开始",     en: "Start" },
  "wbs.thEnd":       { zh: "结束",     en: "End" },
  "wbs.thProgress":  { zh: "进度",     en: "Progress" },
  "wbs.thMilestone": { zh: "里程碑",   en: "Milestone" },
  "wbs.thFloat":     { zh: "浮动",     en: "Float" },
  "wbs.thStatus":    { zh: "状态",     en: "Status" },
  "wbs.statusCompleted": { zh: "已完成", en: "Completed" },
  "wbs.statusStarted":   { zh: "进行中", en: "In Progress" },
  "wbs.statusUnstarted": { zh: "未开始", en: "Not Started" },
  "wbs.tooltipMilestone": { zh: "里程碑", en: "Milestone" },
  "wbs.tooltipCritical":  { zh: "关键路径", en: "Critical Path" },

  // ── EVM Page ──
  "evm.title":             { zh: "挣值分析 (EVM)",         en: "Earned Value Analysis (EVM)" },
  "evm.selectProjectHint": { zh: "请先选择一个项目",        en: "Select a project to begin" },
  "evm.noEvmData":         { zh: "暂无 EVM 数据",          en: "No EVM data" },
  "evm.baseline":          { zh: "基线：",                 en: "Baseline:" },
  "evm.useActiveBaseline": { zh: "使用活跃基线",            en: "Use active baseline" },
  "evm.baselineOpt":       { zh: "项, ",                   en: "items, " },
  "evm.newBaseline":       { zh: "+ 新建基线",              en: "+ New Baseline" },
  "evm.calculateEVM":      { zh: "计算 EVM",               en: "Calculate EVM" },
  "evm.calculating":       { zh: "计算中...",               en: "Calculating..." },
  "evm.statusDate":        { zh: "状态日期：",              en: "Status Date:" },
  "evm.statusDateInfo":    { zh: "状态日期",                en: "Status Date" },
  "evm.baselineNamePh":    { zh: "基线名称 (如: 初始基线 v1)", en: "Baseline name (e.g. Initial Baseline v1)" },

  // EVM KPIs
  "evm.spi":       { zh: "SPI 进度绩效", en: "SPI Schedule Performance" },
  "evm.cpi":       { zh: "CPI 成本绩效", en: "CPI Cost Performance" },
  "evm.eac":       { zh: "EAC 完工估算", en: "EAC Estimate at Completion" },
  "evm.vac":       { zh: "VAC 完工偏差", en: "VAC Variance at Completion" },
  "evm.ahead":     { zh: "进度超前",     en: "Ahead of schedule" },
  "evm.behind":    { zh: "进度落后",     en: "Behind schedule" },
  "evm.underBudget": { zh: "成本节省",   en: "Under budget" },
  "evm.overBudget":  { zh: "成本超支",   en: "Over budget" },
  "evm.surplus":   { zh: "预计结余",     en: "Projected surplus" },
  "evm.overrun":   { zh: "预计超支",     en: "Projected overrun" },

  // EVM detail
  "evm.pvLabel":   { zh: "PV 计划值",   en: "PV Planned Value" },
  "evm.evLabel":   { zh: "EV 挣值",     en: "EV Earned Value" },
  "evm.acLabel":   { zh: "AC 实际成本", en: "AC Actual Cost" },
  "evm.svLabel":   { zh: "SV 进度偏差", en: "SV Schedule Variance" },
  "evm.cvLabel":   { zh: "CV 成本偏差", en: "CV Cost Variance" },
  "evm.sCurve":    { zh: "S 曲线 (PV / EV / AC)", en: "S Curve (PV / EV / AC)" },
  "evm.bacLabel":  { zh: "BAC 预算",    en: "BAC Budget" },
  "evm.taskDetail": { zh: "任务级别 EVM 明细", en: "Task-level EVM Details" },
  "evm.thWBS":     { zh: "WBS",         en: "WBS" },
  "evm.thTask":    { zh: "任务",        en: "Task" },
  "evm.thPlanned": { zh: "计划%",       en: "Planned%" },
  "evm.thActual":  { zh: "实际%",       en: "Actual%" },

  // ── MTA Page ──
  "mta.title":             { zh: "里程碑趋势分析 (MTA)",  en: "Milestone Trend Analysis (MTA)" },
  "mta.selectProjectHint": { zh: "请先选择一个项目",        en: "Select a project to begin" },
  "mta.chartTitle":        { zh: "里程碑趋势图",           en: "Milestone Trend Chart" },
  "mta.slipAnalysis":      { zh: "偏差分析",              en: "Slip Analysis" },
  "mta.current":           { zh: "当前",                  en: "Current" },
  "mta.demoDataNotice":    { zh: "当前显示演示数据。创建基线后将显示真实里程碑趋势。", en: "Showing demo data. Create baselines to see real milestone trends." },
  "mta.loadFailed":        { zh: "加载数据失败",            en: "Failed to load data" },

  // MTA table headers
  "mta.thMilestone":       { zh: "里程碑",                en: "Milestone" },
  "mta.thBaselineDate":    { zh: "基线日期",              en: "Baseline Date" },
  "mta.thCurrentDate":     { zh: "当前日期",              en: "Current Date" },
  "mta.thSlipDays":        { zh: "偏差(天)",              en: "Slip (days)" },
  "mta.thStatus":          { zh: "状态",                  en: "Status" },

  // MTA status labels
  "mta.statusSlipped":     { zh: "延期",                  en: "Slipped" },
  "mta.statusImproved":    { zh: "提前",                  en: "Improved" },
  "mta.statusStable":      { zh: "稳定",                  en: "Stable" },

  // MTA legend
  "mta.howToRead":         { zh: "图例说明",              en: "How to Read" },
  "mta.legendSlipped":     { zh: "日期推迟 (延期)",       en: "Date Pushed Back (Slipped)" },
  "mta.legendSlippedDesc": { zh: "里程碑日期向后期漂移，表示进度滞后", en: "Milestone date shifts later, indicating schedule delay" },
  "mta.legendImproved":    { zh: "日期提前 (改善)",       en: "Date Pulled In (Improved)" },
  "mta.legendImprovedDesc": { zh: "里程碑日期向前提前，表示进度改善", en: "Milestone date shifts earlier, indicating schedule improvement" },
  "mta.legendStable":      { zh: "日期稳定",              en: "Date Stable" },
  "mta.legendStableDesc":  { zh: "里程碑日期无变化，进度按计划执行", en: "No change in milestone date, on track" },

  // ── Resources Page ──
  "res.title":             { zh: "资源管理",       en: "Resource Management" },
  "res.selectProjectHint": { zh: "请先选择一个项目", en: "Select a project to begin" },

  // Resource types
  "res.type.human":     { zh: "人力", en: "Human" },
  "res.type.equipment": { zh: "设备", en: "Equipment" },
  "res.type.material":  { zh: "材料", en: "Material" },
  "res.type.cost":      { zh: "费用", en: "Cost" },

  // Resource views
  "res.viewProject":  { zh: "项目视角", en: "Project View" },
  "res.viewResource": { zh: "资源视角", en: "Resource View" },
  "res.viewTimeline": { zh: "时间线",   en: "Timeline" },

  // Resource project view
  "res.resourcePool":        { zh: "资源池",       en: "Resource Pool" },
  "res.addResource":         { zh: "+ 添加资源",   en: "+ Add Resource" },
  "res.resourceNamePh":      { zh: "资源名称 *",   en: "Resource name *" },
  "res.standardRatePh":      { zh: "标准费率",     en: "Standard rate" },
  "res.groupPh":             { zh: "分组",         en: "Group" },
  "res.confirmAdd":          { zh: "确认添加",     en: "Confirm Add" },
   "res.noResources":         { zh: '暂无资源，点击"添加资源"开始', en: 'No resources, click "Add Resource" to start' },
  "res.thName":             { zh: "名称",         en: "Name" },
  "res.thType":             { zh: "类型",         en: "Type" },
  "res.thStandardRate":     { zh: "标准费率",     en: "Std Rate" },
  "res.thMaxUnits":         { zh: "最大单位",     en: "Max Units" },
  "res.thAllocated":        { zh: "已分配",       en: "Allocated" },
  "res.thGroup":            { zh: "分组",         en: "Group" },
  "res.thActions":          { zh: "操作",         en: "Actions" },
  "res.overloaded":         { zh: "超负荷",       en: "Overloaded" },

  // Resource allocation
  "res.allocation":         { zh: "资源分配",     en: "Resource Allocation" },
  "res.addAllocation":      { zh: "+ 添加分配",   en: "+ Add Allocation" },
  "res.selectResource":     { zh: "选择资源...",  en: "Select resource..." },
  "res.selectTask":         { zh: "选择任务...",  en: "Select task..." },
  "res.unitsPh":            { zh: "分配比例 (0-1)", en: "Allocation units (0-1)" },
  "res.confirmAlloc":       { zh: "确认分配",     en: "Confirm Allocation" },
  "res.noAllocations":      { zh: "暂无分配记录", en: "No allocation records" },
  "res.thResource":         { zh: "资源",         en: "Resource" },
  "res.thTask":             { zh: "任务",         en: "Task" },
  "res.thAllocRatio":       { zh: "分配比例",     en: "Alloc Ratio" },
  "res.thWorkHours":        { zh: "计划工时",     en: "Planned Hours" },

  // Resource cross-project view
  "res.allResources":       { zh: "全部资源",     en: "Total Resources" },
  "res.availableCapacity":  { zh: "有剩余产能",   en: "Available Capacity" },
  "res.fullyLoaded":        { zh: "已满载 (100%)", en: "Fully Loaded (100%)" },
  "res.overloadedPct":      { zh: "超负荷 (>100%)", en: "Overloaded (>100%)" },
  "res.categoryFilter":     { zh: "类别",         en: "Category" },
  "res.resourceFilter":     { zh: "资源",         en: "Resource" },
  "res.overloadedShort":    { zh: "超负荷",       en: "Overloaded" },
  "res.searchCategory":     { zh: "搜索类别...",  en: "Search category..." },
  "res.searchNameDevice":   { zh: "搜索姓名、设备...", en: "Search name, device..." },
  "res.clearFilter":        { zh: "✕ 清除",       en: "✕ Clear" },
  "res.moreItems":          { zh: "项资源",       en: "more resources" },
  "res.noMatching":         { zh: "没有符合条件的资源", en: "No matching resources" },
  "res.itemsCount":         { zh: "个",           en: "items" },
  "res.idle":               { zh: "空闲",         en: "Idle" },
  "res.avgUtilization":     { zh: "平均利用率",   en: "Avg utilization" },
  "res.remaining":          { zh: "剩",           en: "Left" },
  "res.available":          { zh: "可用",         en: "Available" },
  "res.notAllocated":       { zh: "此资源尚未被分配到任何任务", en: "This resource is not allocated to any task" },
  "res.allocDetail":        { zh: "分配详情",   en: "Allocation Details" },
  "res.thProject":          { zh: "项目",         en: "Project" },
  "res.totalAlloc":         { zh: "总分配",       en: "Total alloc" },
  "res.maximum":            { zh: "最大",         en: "Max" },
  "res.remainLabel":        { zh: "剩余",         en: "Remaining" },
  "res.utilization":        { zh: "利用率",       en: "Utilization" },

  // ── PivotFilter ──
  "filter.search":       { zh: "搜索...",   en: "Search..." },
  "filter.selectAll":    { zh: "全选",       en: "Select All" },
  "filter.deselectAll":  { zh: "全不选",     en: "Deselect All" },
  "filter.selectedOf":   { zh: "已选",       en: "selected" },
  "filter.noMatch":      { zh: "无匹配项",   en: "No matches" },
  "filter.selectedItems": { zh: "已选",      en: "Selected" },
  "filter.clearAll":     { zh: "清除全部",   en: "Clear All" },
  "filter.itemsUnit":    { zh: "项",         en: "items" },

  // ── Resource Timeline View ──
  "timeline.loadFailed":   { zh: "加载时间线数据...", en: "Loading timeline data..." },
  "timeline.noData":       { zh: "暂无资源或分配数据", en: "No resource or allocation data" },
  "timeline.availableTime": { zh: "可用时间", en: "Available" },
  "timeline.allocated":    { zh: "已分配",   en: "Allocated" },
  "timeline.remaining":    { zh: "剩余",     en: "Remaining" },
  "timeline.utilization":  { zh: "利用率",   en: "Utilization" },
  "timeline.clearFilter":  { zh: "✕ 清除筛选", en: "✕ Clear Filters" },
  "timeline.legendFree":   { zh: "空闲",     en: "Free" },
  "timeline.legendPartial": { zh: "部分",    en: "Partial" },
  "timeline.legendFull":   { zh: "满载",     en: "Full" },
  "timeline.legendOver":   { zh: "超负荷",   en: "Overloaded" },
  "timeline.thResource":   { zh: "资源",     en: "Resource" },
  "timeline.total":        { zh: "合计",     en: "Total" },

  // Month names
  "month.1":  { zh: "1月",  en: "Jan" },
  "month.2":  { zh: "2月",  en: "Feb" },
  "month.3":  { zh: "3月",  en: "Mar" },
  "month.4":  { zh: "4月",  en: "Apr" },
  "month.5":  { zh: "5月",  en: "May" },
  "month.6":  { zh: "6月",  en: "Jun" },
  "month.7":  { zh: "7月",  en: "Jul" },
  "month.8":  { zh: "8月",  en: "Aug" },
  "month.9":  { zh: "9月",  en: "Sep" },
  "month.10": { zh: "10月", en: "Oct" },
  "month.11": { zh: "11月", en: "Nov" },
  "month.12": { zh: "12月", en: "Dec" },
};

interface I18nContextValue {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  toggleLang: () => void;
}

export const I18nContext = createContext<I18nContextValue>({
  lang: "zh",
  t: (k) => k,
  toggleLang: () => {},
});

export function useLang() {
  return useContext(I18nContext);
}

export type { I18nContextValue };
export { dict };
