"""Plane REST API async client for data synchronization."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class PlaneClient:
    """Async HTTP client for Plane REST API v1."""

    def __init__(self, base_url: str | None = None, api_token: str | None = None):
        self.base_url = (base_url or settings.PLANE_BASE_URL).rstrip("/")
        self.api_token = api_token or settings.PLANE_API_TOKEN
        self.workspace_slug = settings.PLANE_WORKSPACE_SLUG
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {}
            if self.api_token:
                headers["X-API-Key"] = self.api_token
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=30.0,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Generic helpers
    # ------------------------------------------------------------------

    async def _get(self, path: str, params: dict | None = None) -> dict | list:
        client = await self._get_client()
        resp = await client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, data: dict) -> dict:
        client = await self._get_client()
        resp = await client.post(path, json=data)
        resp.raise_for_status()
        return resp.json()

    async def _patch(self, path: str, data: dict) -> dict:
        client = await self._get_client()
        resp = await client.patch(path, json=data)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------

    async def list_projects(self) -> list[dict]:
        """List all projects in the workspace."""
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    async def get_project(self, project_id: str) -> dict:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/"
        return await self._get(path)

    # ------------------------------------------------------------------
    # Work Items
    # ------------------------------------------------------------------

    async def list_workitems(
        self, project_id: str, cursor: str | None = None, per_page: int = 100
    ) -> dict:
        """List work items with pagination. Returns {results, next_cursor}."""
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-items/"
        params = {"per_page": per_page, "expand": "parent,state"}
        if cursor:
            params["cursor"] = cursor
        return await self._get(path, params)

    async def list_all_workitems(self, project_id: str) -> list[dict]:
        """Fetch all work items, handling pagination automatically."""
        all_items = []
        cursor = None
        while True:
            page = await self.list_workitems(project_id, cursor=cursor)
            results = page if isinstance(page, list) else page.get("results", [])
            all_items.extend(results)
            cursor = page.get("next_cursor") if isinstance(page, dict) else None
            if not cursor or not results:
                break
        return all_items

    async def get_workitem(self, project_id: str, workitem_id: str) -> dict:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-items/{workitem_id}/"
        return await self._get(path)

    async def update_workitem(self, project_id: str, workitem_id: str, data: dict) -> dict:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-items/{workitem_id}/"
        return await self._patch(path, data)

    # ------------------------------------------------------------------
    # Work Item Relations (dependencies)
    # ------------------------------------------------------------------

    async def list_relations(self, project_id: str) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-item-relations/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    async def create_relation(
        self, project_id: str, relation_type: str, source_id: str, target_id: str
    ) -> dict:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-item-relations/"
        data = {
            "relation_type": relation_type,
            "source": source_id,
            "target": target_id,
        }
        return await self._post(path, data)

    # ------------------------------------------------------------------
    # Work Logs
    # ------------------------------------------------------------------

    async def list_worklogs(self, project_id: str, workitem_id: str) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/work-items/{workitem_id}/work-logs/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    # ------------------------------------------------------------------
    # Members
    # ------------------------------------------------------------------

    async def list_members(self) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/members/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    # ------------------------------------------------------------------
    # Cycles & Modules
    # ------------------------------------------------------------------

    async def list_cycles(self, project_id: str) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/cycles/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    async def list_modules(self, project_id: str) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/modules/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])

    # ------------------------------------------------------------------
    # States
    # ------------------------------------------------------------------

    async def list_states(self, project_id: str) -> list[dict]:
        path = f"/api/v1/workspaces/{self.workspace_slug}/projects/{project_id}/states/"
        result = await self._get(path)
        return result if isinstance(result, list) else result.get("results", [])


# Singleton
_plane_client: PlaneClient | None = None


def get_plane_client() -> PlaneClient:
    global _plane_client
    if _plane_client is None:
        _plane_client = PlaneClient()
    return _plane_client
