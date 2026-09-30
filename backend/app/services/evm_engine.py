"""
EVM (Earned Value Management) Engine.

Calculates standard EVM metrics:
  - PV (Planned Value): budgeted cost of work scheduled
  - EV (Earned Value): budgeted cost of work performed
  - AC (Actual Cost): actual cost of work performed
  - BAC (Budget at Completion): total project budget
  - SV = EV - PV (Schedule Variance)
  - CV = EV - AC (Cost Variance)
  - SPI = EV / PV (Schedule Performance Index)
  - CPI = EV / AC (Cost Performance Index)
  - EAC = BAC / CPI (Estimate at Completion)
  - ETC = EAC - AC (Estimate to Complete)
  - VAC = BAC - EAC (Variance at Completion)
  - TCPI = (BAC - EV) / (BAC - AC) (To-Complete Performance Index)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class TaskEVMDetail:
    """EVM data for a single task."""

    workitem_id: str
    name: str
    wbs_code: str = ""

    # Budget
    planned_cost: float = 0.0  # baseline budget for this task

    # Schedule
    baseline_start: Optional[date] = None
    baseline_end: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    current_start: Optional[date] = None
    current_end: Optional[date] = None

    # Progress
    planned_percent: float = 0.0  # % that should be complete by status_date
    actual_percent: float = 0.0  # % actually complete

    # Cost
    actual_cost: float = 0.0  # from worklogs + resource rates

    # Calculated
    pv: float = 0.0
    ev: float = 0.0
    ac: float = 0.0


@dataclass
class EVMResult:
    """Complete EVM calculation result for a project."""

    status_date: date
    bac: float = 0.0  # Budget at Completion

    # Aggregated values
    pv: float = 0.0
    ev: float = 0.0
    ac: float = 0.0

    # Variances
    sv: float = 0.0  # Schedule Variance
    cv: float = 0.0  # Cost Variance

    # Performance indices
    spi: float = 0.0
    cpi: float = 0.0

    # Forecasts
    eac: float = 0.0  # Estimate at Completion
    etc: float = 0.0  # Estimate to Complete
    vac: float = 0.0  # Variance at Completion
    tcpi: float = 0.0  # To-Complete Performance Index

    # Per-task detail
    task_details: list[TaskEVMDetail] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "status_date": self.status_date.isoformat(),
            "bac": round(self.bac, 2),
            "pv": round(self.pv, 2),
            "ev": round(self.ev, 2),
            "ac": round(self.ac, 2),
            "sv": round(self.sv, 2),
            "cv": round(self.cv, 2),
            "spi": round(self.spi, 4),
            "cpi": round(self.cpi, 4),
            "eac": round(self.eac, 2),
            "etc": round(self.etc, 2),
            "vac": round(self.vac, 2),
            "tcpi": round(self.tcpi, 4),
            "task_details": [
                {
                    "workitem_id": t.workitem_id,
                    "name": t.name,
                    "wbs_code": t.wbs_code,
                    "pv": round(t.pv, 2),
                    "ev": round(t.ev, 2),
                    "ac": round(t.ac, 2),
                    "planned_percent": t.planned_percent,
                    "actual_percent": t.actual_percent,
                }
                for t in self.task_details
            ],
        }


class EVMEngine:
    """Earned Value Management calculation engine."""

    def __init__(
        self,
        status_date: date,
        bac: float = 0.0,
    ):
        self.status_date = status_date
        self.bac = bac

    def _calculate_planned_percent(
        self,
        baseline_start: Optional[date],
        baseline_end: Optional[date],
    ) -> float:
        """Calculate what % of a task should be complete by the status date."""
        if not baseline_start or not baseline_end:
            return 0.0

        total_days = (baseline_end - baseline_start).days
        if total_days <= 0:
            # Milestone: 0% if before, 100% if on or after
            return 1.0 if self.status_date >= baseline_end else 0.0

        elapsed = (self.status_date - baseline_start).days
        if elapsed <= 0:
            return 0.0
        if elapsed >= total_days:
            return 1.0
        return elapsed / total_days

    def calculate(self, tasks: list[TaskEVMDetail]) -> EVMResult:
        """
        Calculate EVM metrics for a list of tasks.

        Each task should have:
        - planned_cost (from baseline)
        - baseline_start / baseline_end
        - actual_percent (from current progress)
        - actual_cost (from worklogs + resource rates)
        """
        result = EVMResult(status_date=self.status_date, bac=self.bac)

        for task in tasks:
            # PV = planned_cost × planned_percent
            task.planned_percent = self._calculate_planned_percent(
                task.baseline_start, task.baseline_end
            )
            task.pv = task.planned_cost * task.planned_percent

            # EV = planned_cost × actual_percent
            task.ev = task.planned_cost * task.actual_percent

            # AC = actual cost from worklogs
            task.ac = task.actual_cost

            # Aggregate
            result.pv += task.pv
            result.ev += task.ev
            result.ac += task.ac
            result.task_details.append(task)

        # If BAC is not set, use sum of planned costs
        if result.bac <= 0:
            result.bac = sum(t.planned_cost for t in tasks)

        # Variances
        result.sv = result.ev - result.pv
        result.cv = result.ev - result.ac

        # Performance indices
        if result.pv > 0:
            result.spi = result.ev / result.pv
        if result.ac > 0:
            result.cpi = result.ev / result.ac

        # Forecasts
        if result.cpi > 0:
            result.eac = result.bac / result.cpi
        else:
            result.eac = result.bac

        result.etc = result.eac - result.ac
        result.vac = result.bac - result.eac

        # TCPI = (BAC - EV) / (BAC - AC)
        if (result.bac - result.ac) > 0:
            result.tcpi = (result.bac - result.ev) / (result.bac - result.ac)

        return result
