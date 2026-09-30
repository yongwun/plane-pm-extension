"""
CPM (Critical Path Method) Engine.

Calculates:
  - ES (Early Start), EF (Early Finish)  — Forward pass
  - LS (Late Start), LF (Late Finish)    — Backward pass
  - Total Float = LS - ES  (or LF - EF)
  - Free Float = min(ES of successors) - EF
  - Critical Path = tasks where Total Float == 0
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import networkx as nx

logger = logging.getLogger(__name__)


@dataclass
class TaskNode:
    """Represents a task for CPM calculation."""

    id: str  # workitem_ext_id (UUID string)
    plane_workitem_id: str
    name: str
    duration_days: float
    is_milestone: bool = False
    constraint_type: str = "ASAP"
    constraint_date: Optional[datetime] = None

    # Dependencies: list of (predecessor_id, dependency_type, lag_days)
    predecessors: list[tuple[str, str, float]] = field(default_factory=list)
    successors: list[tuple[str, str, float]] = field(default_factory=list)

    # Calculated fields (populated by CPM engine)
    early_start: Optional[datetime] = None
    early_finish: Optional[datetime] = None
    late_start: Optional[datetime] = None
    late_finish: Optional[datetime] = None
    total_float: Optional[float] = None
    free_float: Optional[float] = None
    is_critical: bool = False

    # Parent for WBS grouping
    parent_id: Optional[str] = None


class CPMEngine:
    """
    Critical Path Method calculation engine.

    Uses networkx DAG to model task dependencies and compute
    forward/backward passes for schedule analysis.
    """

    def __init__(
        self,
        tasks: list[TaskNode],
        project_start: datetime,
        work_days_per_week: int = 5,
        work_hours_per_day: float = 8.0,
    ):
        self.tasks = {t.id: t for t in tasks}
        self.project_start = project_start
        self.work_days_per_week = work_days_per_week
        self.work_hours_per_day = work_hours_per_day
        self.graph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self):
        """Build a directed acyclic graph from tasks and dependencies."""
        for task in self.tasks.values():
            self.graph.add_node(task.id)

        for task in self.tasks.values():
            for pred_id, dep_type, lag in task.predecessors:
                if pred_id in self.tasks:
                    self.graph.add_edge(pred_id, task.id, dep_type=dep_type, lag=lag)

    def _is_work_day(self, dt: datetime) -> bool:
        """Check if a date is a work day (Mon–Fri by default)."""
        if self.work_days_per_week == 7:
            return True
        if self.work_days_per_week == 6:
            return dt.weekday() < 6
        return dt.weekday() < 5  # Mon-Fri

    def _add_work_days(self, start: datetime, days: float) -> datetime:
        """Add work days to a date, skipping weekends."""
        if days <= 0:
            return start
        current = start
        remaining = days
        max_iterations = int(days * 3) + 30  # safety limit
        iterations = 0
        while remaining > 0 and iterations < max_iterations:
            current += timedelta(days=1)
            if self._is_work_day(current):
                remaining -= 1
            iterations += 1
        return current

    def _subtract_work_days(self, end: datetime, days: float) -> datetime:
        """Subtract work days from a date, skipping weekends."""
        if days <= 0:
            return end
        current = end
        remaining = days
        max_iterations = int(days * 3) + 30
        iterations = 0
        while remaining > 0 and iterations < max_iterations:
            current -= timedelta(days=1)
            if self._is_work_day(current):
                remaining -= 1
            iterations += 1
        return current

    def _count_work_days(self, start: datetime, end: datetime) -> float:
        """Count work days between two dates."""
        if start >= end:
            return 0
        count = 0
        current = start
        while current < end:
            current += timedelta(days=1)
            if self._is_work_day(current):
                count += 1
        return count

    def _compute_dependency_date(
        self,
        pred: TaskNode,
        succ: TaskNode,
        dep_type: str,
        lag_days: float,
    ) -> datetime:
        """Compute the earliest date a successor can start/finish based on dependency type."""
        lag = timedelta(days=int(lag_days))

        if dep_type == "FS":  # Finish-to-Start
            return pred.early_finish + lag
        elif dep_type == "SS":  # Start-to-Start
            return pred.early_start + lag
        elif dep_type == "FF":  # Finish-to-Finish
            return pred.early_finish + lag
        elif dep_type == "SF":  # Start-to-Finish
            return pred.early_start + lag
        else:
            return pred.early_finish + lag

    def calculate(self) -> dict[str, TaskNode]:
        """
        Run full CPM calculation: forward pass → backward pass → float → critical path.
        Returns updated tasks dict.
        """
        if not self.tasks:
            return self.tasks

        # Check for cycles
        if not nx.is_directed_acyclic_graph(self.graph):
            cycles = list(nx.simple_cycles(self.graph))
            raise ValueError(f"Dependency cycle detected: {cycles}")

        # ---- Forward Pass (ES / EF) ----
        topo_order = list(nx.topological_sort(self.graph))

        for node_id in topo_order:
            task = self.tasks[node_id]
            predecessors = list(self.graph.predecessors(node_id))

            if not predecessors:
                # No predecessors: start at project start (or constraint date)
                if task.constraint_type in ("MSO", "SNET") and task.constraint_date:
                    task.early_start = task.constraint_date
                else:
                    task.early_start = self.project_start
            else:
                # ES = max of all predecessor-driven dates
                earliest = self.project_start
                for pred_id in predecessors:
                    pred = self.tasks[pred_id]
                    edge_data = self.graph.edges[pred_id, node_id]
                    dep_type = edge_data.get("dep_type", "FS")
                    lag = edge_data.get("lag", 0)
                    dep_date = self._compute_dependency_date(pred, task, dep_type, lag)

                    if dep_type in ("FS", "SS"):
                        # These determine when successor can START
                        if dep_date > earliest:
                            earliest = dep_date
                    elif dep_type == "FF":
                        # FF determines when successor must FINISH, so start = finish - duration
                        start_from_ff = self._subtract_work_days(dep_date, task.duration_days)
                        if start_from_ff > earliest:
                            earliest = start_from_ff
                    elif dep_type == "SF":
                        start_from_sf = self._subtract_work_days(dep_date, task.duration_days)
                        if start_from_sf > earliest:
                            earliest = start_from_sf

                task.early_start = earliest

            # EF = ES + duration (in work days)
            if task.is_milestone or task.duration_days <= 0:
                task.early_finish = task.early_start
            else:
                task.early_finish = self._add_work_days(task.early_start, task.duration_days)

        # ---- Backward Pass (LS / LF) ----
        # Find project end = max EF
        project_end = max(t.early_finish for t in self.tasks.values() if t.early_finish)

        reverse_topo = list(reversed(topo_order))

        for node_id in reverse_topo:
            task = self.tasks[node_id]
            successors = list(self.graph.successors(node_id))

            if not successors:
                # No successors: LF = project end
                task.late_finish = project_end
            else:
                # LF = min of all successor-driven late dates
                latest = project_end
                for succ_id in successors:
                    succ = self.tasks[succ_id]
                    edge_data = self.graph.edges[node_id, succ_id]
                    dep_type = edge_data.get("dep_type", "FS")
                    lag = edge_data.get("lag", 0)

                    if dep_type == "FS":
                        candidate = succ.late_start - timedelta(days=int(lag))
                    elif dep_type == "SS":
                        candidate = succ.late_start - timedelta(days=int(lag))
                    elif dep_type == "FF":
                        candidate = succ.late_finish - timedelta(days=int(lag))
                    elif dep_type == "SF":
                        candidate = succ.late_finish - timedelta(days=int(lag))
                    else:
                        candidate = succ.late_start - timedelta(days=int(lag))

                    if candidate < latest:
                        latest = candidate

                task.late_finish = latest

            # LS = LF - duration
            if task.is_milestone or task.duration_days <= 0:
                task.late_start = task.late_finish
            else:
                task.late_start = self._subtract_work_days(task.late_finish, task.duration_days)

        # ---- Float Calculation ----
        for task in self.tasks.values():
            if task.early_start and task.late_start:
                task.total_float = self._count_work_days(task.early_start, task.late_start)
                # Also compute as negative if late < early (shouldn't happen in valid schedule)
                if task.late_start < task.early_start:
                    task.total_float = -self._count_work_days(task.late_start, task.early_start)

            # Free Float = min(ES of successors) - EF of this task
            successors = list(self.graph.successors(task.id))
            if successors and task.early_finish:
                min_succ_es = min(
                    self.tasks[s].early_start
                    for s in successors
                    if self.tasks[s].early_start
                )
                task.free_float = self._count_work_days(task.early_finish, min_succ_es)
            else:
                task.free_float = task.total_float

        # ---- Critical Path ----
        for task in self.tasks.values():
            task.is_critical = task.total_float is not None and abs(task.total_float) < 0.5

        return self.tasks

    def get_critical_path(self) -> list[str]:
        """Return the list of task IDs on the critical path, in topological order."""
        topo_order = list(nx.topological_sort(self.graph))
        return [nid for nid in topo_order if self.tasks[nid].is_critical]

    def get_summary(self) -> dict:
        """Return a summary of the CPM calculation."""
        critical = self.get_critical_path()
        total_tasks = len(self.tasks)
        critical_tasks = len(critical)

        project_end = max(
            (t.early_finish for t in self.tasks.values() if t.early_finish),
            default=self.project_start,
        )
        total_duration = self._count_work_days(self.project_start, project_end)

        return {
            "project_start": self.project_start.isoformat(),
            "project_end": project_end.isoformat(),
            "total_duration_days": total_duration,
            "total_tasks": total_tasks,
            "critical_tasks": critical_tasks,
            "critical_path": critical,
        }
