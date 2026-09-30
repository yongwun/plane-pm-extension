/** API client for PM Extension backend. */

const API_BASE = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const projects = {
  list: () => request<ProjectExt[]>("/projects/"),
  get: (projectExtId: string) =>
    request<ProjectExt>(`/projects/${projectExtId}`),
  create: (data: CreateProjectExt) =>
    request<ProjectExt>("/projects/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectExtId: string, data: Partial<ProjectExt>) =>
    request<ProjectExt>(`/projects/${projectExtId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  syncFromPlane: () =>
    request<ProjectExt[]>("/projects/sync-from-plane", { method: "POST" }),
  syncWorkitems: (projectExtId: string) =>
    request<{ created: number; updated: number; total: number }>(
      `/projects/sync-workitems/${projectExtId}`,
      { method: "POST" }
    ),
};

// Gantt
export const gantt = {
  getData: (projectExtId: string) =>
    request<GanttData>(`/gantt/${projectExtId}/data`),
  getWBS: (projectExtId: string) =>
    request<WBSResponse>(`/gantt/${projectExtId}/wbs`),
  calculateCPM: (projectExtId: string) =>
    request<CPMResult>(`/gantt/${projectExtId}/cpm`, { method: "POST" }),
  updateWorkitem: (projectExtId: string, workitemId: string, data: WorkitemUpdate) =>
    request<{ id: string; updated: boolean }>(`/gantt/${projectExtId}/workitems/${workitemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  listDependencies: (projectExtId: string) =>
    request<GanttDependency[]>(`/gantt/${projectExtId}/dependencies`),
  createDependency: (projectExtId: string, data: CreateDependency) =>
    request<GanttDependency>(`/gantt/${projectExtId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDependency: (projectExtId: string, depId: string) =>
    request<void>(`/gantt/${projectExtId}/dependencies/${depId}`, {
      method: "DELETE",
    }),
};

// Resources
export const resources = {
  list: (projectExtId: string) =>
    request<Resource[]>(`/resources/${projectExtId}/pool`),
  create: (projectExtId: string, data: CreateResource) =>
    request<Resource>(`/resources/${projectExtId}/pool`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectExtId: string, resourceId: string, data: Partial<Resource>) =>
    request<Resource>(`/resources/${projectExtId}/pool/${resourceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (projectExtId: string, resourceId: string) =>
    request<void>(`/resources/${projectExtId}/pool/${resourceId}`, {
      method: "DELETE",
    }),
  listAllocations: (projectExtId: string) =>
    request<Allocation[]>(`/resources/${projectExtId}/allocations`),
  createAllocation: (projectExtId: string, data: CreateAllocation) =>
    request<Allocation>(`/resources/${projectExtId}/allocations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAllocation: (projectExtId: string, allocId: string) =>
    request<void>(`/resources/${projectExtId}/allocations/${allocId}`, {
      method: "DELETE",
    }),
  crossProjectSummary: () =>
    request<ResourceSummary[]>("/resources/cross-project/summary"),
  histogram: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const qs = params.toString();
    return request<ResourceTimeline[]>(`/resources/cross-project/histogram${qs ? `?${qs}` : ""}`);
  },
};

// Baseline
export const baseline = {
  list: (projectExtId: string) =>
    request<Baseline[]>(`/baseline/${projectExtId}/baselines`),
  create: (projectExtId: string, data: CreateBaseline) =>
    request<Baseline>(`/baseline/${projectExtId}/baselines`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getItems: (projectExtId: string, baselineId: string) =>
    request<BaselineItem[]>(
      `/baseline/${projectExtId}/baselines/${baselineId}/items`
    ),
  delete: (projectExtId: string, baselineId: string) =>
    request<void>(`/baseline/${projectExtId}/baselines/${baselineId}`, {
      method: "DELETE",
    }),
};

// EVM
export const evm = {
  calculate: (data: EVMCalculateRequest) =>
    request<EVMResult>("/evm/calculate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  history: (projectExtId: string) =>
    request<EVMResult[]>(`/evm/${projectExtId}/history`),
};

// ---- Types ----

export interface ProjectExt {
  id: string;
  plane_project_id: string;
  plane_project_name: string;
  workspace_slug: string;
  work_hours_per_day: number;
  work_days_per_week: number;
  budget: number;
  currency: string;
}

export interface CreateProjectExt {
  plane_project_id: string;
  plane_project_name?: string;
  workspace_slug?: string;
  budget?: number;
}

export interface GanttTask {
  id: string;
  plane_workitem_id: string;
  name: string;
  wbs_code: string;
  outline_level: number;
  parent_id: string | null;
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
  fixed_cost: number;
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

export interface CPMResult {
  project_id: string;
  project_start: string;
  project_end: string;
  total_duration_days: number;
  total_tasks: number;
  critical_tasks: number;
  critical_path: string[];
  tasks: GanttTask[];
}

export interface WBSResponse {
  project_id: string;
  tree: WBNode[];
  flat: WBNode[];
}

export interface WBNode {
  id: string;
  plane_workitem_id: string;
  name: string;
  wbs_code: string;
  outline_level: number;
  parent_id: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  is_milestone: boolean;
  percent_complete: number;
  is_critical: boolean;
  total_float: number | null;
  state: string;
  children: WBNode[];
}

export interface CreateDependency {
  predecessor_workitem_id: string;
  successor_workitem_id: string;
  dependency_type: string;
  lag_days: number;
}

export interface WorkitemUpdate {
  fixed_cost?: number;
  percent_complete?: number;
  duration_days?: number;
  is_milestone?: boolean;
  constraint_type?: string;
  constraint_date?: string;
  notes?: string;
}

export interface Resource {
  id: string;
  project_ext_id: string;
  name: string;
  resource_type: string;
  email: string | null;
  standard_rate: number;
  overtime_rate: number;
  cost_per_use: number;
  max_units: number;
  is_active: boolean;
  group_name: string | null;
  code: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateResource {
  project_ext_id: string;
  name: string;
  resource_type?: string;
  email?: string;
  standard_rate?: number;
  overtime_rate?: number;
  max_units?: number;
  group_name?: string;
}

export interface Allocation {
  id: string;
  resource_id: string;
  workitem_ext_id: string;
  units: number;
  work_hours: number | null;
  actual_work_hours: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateAllocation {
  resource_id: string;
  workitem_ext_id: string;
  units?: number;
  work_hours?: number;
}

export interface Baseline {
  id: string;
  project_ext_id: string;
  name: string;
  baseline_date: string;
  is_active: boolean;
  items_count: number;
}

export interface CreateBaseline {
  project_ext_id: string;
  name: string;
  description?: string;
}

export interface BaselineItem {
  id: string;
  baseline_id: string;
  plane_workitem_id: string;
  wbs_code: string | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  percent_complete: number | null;
}

export interface EVMResult {
  status_date: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  cv: number;
  spi: number;
  cpi: number;
  eac: number;
  etc: number;
  vac: number;
  tcpi: number;
  task_details: EVMTaskDetail[];
}

export interface EVMTaskDetail {
  workitem_id: string;
  name: string;
  wbs_code: string;
  pv: number;
  ev: number;
  ac: number;
  planned_percent: number;
  actual_percent: number;
}

export interface EVMCalculateRequest {
  project_ext_id: string;
  baseline_id?: string;
  status_date?: string;
}

export interface AllocDetail {
  alloc_id: string;
  project_ext_id: string;
  project_name: string;
  task_name: string;
  task_id: string;
  units: number;
  work_hours: number | null;
}

export interface ResourceSummary {
  id: string;
  project_ext_id: string;
  project_name: string;
  name: string;
  resource_type: string;
  standard_rate: number;
  max_units: number;
  group_name: string | null;
  is_active: boolean;
  total_allocated: number;
  remaining: number;
  utilization_pct: number;
  allocations: AllocDetail[];
}

export interface DayData {
  date: string;
  day_label: string;
  is_weekend: boolean;
  is_working_day: boolean;
  available_hours: number;
  allocated_hours: number;
  remaining_hours: number;
  utilization_pct: number;
}

export interface ResourceTimeline {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  project_name: string;
  group_name: string | null;
  max_units: number;
  days: DayData[];
}
