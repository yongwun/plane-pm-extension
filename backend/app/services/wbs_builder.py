"""WBS (Work Breakdown Structure) builder.

Generates hierarchical WBS codes from Plane's parent-child work item structure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WBSNode:
    """A node in the WBS tree."""

    id: str
    plane_workitem_id: str
    name: str
    wbs_code: str = ""
    outline_level: int = 0
    parent_id: Optional[str] = None
    children: list[WBSNode] = field(default_factory=list)

    # Schedule data (for display)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_days: float = 0
    is_milestone: bool = False
    percent_complete: float = 0.0
    is_critical: bool = False
    state: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "plane_workitem_id": self.plane_workitem_id,
            "name": self.name,
            "wbs_code": self.wbs_code,
            "outline_level": self.outline_level,
            "parent_id": self.parent_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "duration_days": self.duration_days,
            "is_milestone": self.is_milestone,
            "percent_complete": self.percent_complete,
            "is_critical": self.is_critical,
            "state": self.state,
            "children": [c.to_dict() for c in self.children],
        }


class WBSBuilder:
    """Build WBS tree from flat list of work items with parent references."""

    def __init__(self, separator: str = "."):
        self.separator = separator

    def build(
        self,
        items: list[dict],
    ) -> list[WBSNode]:
        """
        Build WBS tree from a list of work item dicts.

        Each item dict should have:
          - id: workitem_ext_id
          - plane_workitem_id
          - name
          - parent_id (None for top-level)
          - start_date, end_date, duration_days, etc.
        """
        # Create nodes
        nodes: dict[str, WBSNode] = {}
        for item in items:
            node = WBSNode(
                id=item["id"],
                plane_workitem_id=item.get("plane_workitem_id", ""),
                name=item.get("name", ""),
                parent_id=item.get("parent_id"),
                start_date=item.get("start_date"),
                end_date=item.get("end_date"),
                duration_days=item.get("duration_days", 0),
                is_milestone=item.get("is_milestone", False),
                percent_complete=item.get("percent_complete", 0),
                is_critical=item.get("is_critical", False),
                state=item.get("state", ""),
            )
            nodes[node.id] = node

        # Build parent-child relationships
        roots: list[WBSNode] = []
        for node in nodes.values():
            if node.parent_id and node.parent_id in nodes:
                parent = nodes[node.parent_id]
                parent.children.append(node)
            else:
                roots.append(node)

        # Sort children by their original order (or name)
        def sort_key(n: WBSNode):
            return n.name

        def sort_tree(node_list: list[WBSNode]):
            node_list.sort(key=sort_key)
            for n in node_list:
                sort_tree(n.children)

        sort_tree(roots)

        # Assign WBS codes
        self._assign_codes(roots, prefix="")

        return roots

    def _assign_codes(self, nodes: list[WBSNode], prefix: str):
        """Recursively assign WBS codes."""
        for i, node in enumerate(nodes, 1):
            if prefix:
                node.wbs_code = f"{prefix}{self.separator}{i}"
            else:
                node.wbs_code = str(i)
            node.outline_level = node.wbs_code.count(self.separator)
            self._assign_codes(node.children, node.wbs_code)

    def flatten(self, roots: list[WBSNode]) -> list[dict]:
        """Flatten the WBS tree to a list of dicts (for table display)."""
        result = []

        def walk(nodes: list[WBSNode]):
            for node in nodes:
                result.append(node.to_dict())
                walk(node.children)

        walk(roots)
        return result
