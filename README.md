# Plane PM Extension

> **Project Management Extension for [Plane](https://github.com/makeplane/plane)** — Add professional PM capabilities (Gantt, WBS, EVM, Resource Management) to your Plane instance.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](#)
[![Plane](https://img.shields.io/badge/Plane-Self--Hosted-purple)](https://plane.so)

📖 [中文说明](README_CN.md) | [Screenshots](SCREENSHOTS.md)

---

## Overview

Plane PM Extension is a companion application that extends [Plane](https://plane.so) (self-hosted) with advanced project management features typically found in desktop tools like Microsoft Project or ProjectLibre:

- **Gantt Chart** — Interactive timeline with drag-and-drop scheduling, dependency arrows, critical path highlighting
- **WBS (Work Breakdown Structure)** — Hierarchical task tree with inline editing
- **Resource Management** — Cross-project resource allocation, utilization heatmap, capacity planning
- **EVM (Earned Value Management)** — PV/EV/AC/SPI/CPI metrics with S-Curve visualization
- **Baseline Management** — Save and compare project baselines
- **CPM Engine** — Critical Path Method with forward/backward pass calculation

<p align="center">
  <img src="docs/screenshots/01-homepage.png" alt="Homepage" width="800">
</p>

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Browser (localhost:3000)             │
│              Next.js 15 + React 19 + TailwindCSS     │
├──────────────────────────────────────────────────────┤
│              PM Extension API (localhost:8080)         │
│                  FastAPI + SQLAlchemy                 │
├──────────────────────┬───────────────────────────────┤
│   Plane API (:8000)  │    PostgreSQL (:5432)          │
│   (REST - read/write)│    (Extension tables)          │
└──────────────────────┴───────────────────────────────┘
         ▲
         │
┌────────┴───────────────────────────────────────────┐
│               Plane Self-Hosted (Docker)             │
│   Web UI (:9394) │ API │ Worker │ DB │ Redis │ MQ  │
└────────────────────────────────────────────────────┘
```

---

## Features

### Gantt Chart
- Interactive drag-and-drop task bars
- Auto-scheduling with CPM (Critical Path Method)
- Dependency links (FS, FF, SS, SF) with lag
- Critical path highlighting
- Progress bars and milestone markers
- Baseline comparison overlay

<p align="center">
  <img src="docs/screenshots/02-gantt-chart.png" alt="Gantt Chart" width="800">
</p>

### WBS (Work Breakdown Structure)
- Hierarchical tree view with expand/collapse
- Inline editing: duration, start date, progress, milestone
- Add/delete/reorder tasks
- Lock/unlock editing mode

<p align="center">
  <img src="docs/screenshots/03-wbs.png" alt="WBS" width="800">
</p>

### Resource Management
- **Project View**: Manage resource pools per project, assign resources to tasks
- **Resource View**: Cross-project allocation summary with category grouping
- **Timeline View**: Day-by-day utilization heatmap (Gantt-style)
- **Pivot Filter**: Excel-style multi-level filter with search, select-all, scrollable list
- Overallocation detection and warning

<p align="center">
  <img src="docs/screenshots/04-resources-project.png" alt="Resource Management - Project View" width="800">
  <br><em>Project View: resource pool and task allocation</em>
</p>

<p align="center">
  <img src="docs/screenshots/05-resources-resource.png" alt="Resource Management - Resource View" width="800">
  <br><em>Resource View: cross-project allocation summary</em>
</p>

<p align="center">
  <img src="docs/screenshots/06-resources-timeline.png" alt="Resource Management - Timeline" width="800">
  <br><em>Timeline View: daily utilization heatmap</em>
</p>

### EVM (Earned Value Management)
- Real-time PV / EV / AC calculation
- SPI, CPI, EAC, ETC, VAC metrics
- S-Curve chart (ECharts)
- Performance indicator dashboard

<p align="center">
  <img src="docs/screenshots/07-evm.png" alt="EVM Dashboard" width="800">
</p>

### Baseline
- Save project baseline snapshots
- Compare current vs. baseline (planned vs. actual)
- Variance analysis

---

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Docker & Docker Compose** | 24+ / 2.20+ | [Install Docker](https://docs.docker.com/engine/install/) |
| **Plane Self-Hosted** | Latest stable | Running on `localhost:9394` |
| **Node.js** | 20+ | Only for local frontend development |
| **Python** | 3.12+ | Only for local backend development |

### Step 1: Deploy Plane (Self-Hosted)

If you don't have Plane running yet, follow the [official Plane Docker setup](https://docs.plane.so/self-hosting/methods/docker-compose):

```bash
# Clone Plane
git clone https://github.com/makeplane/plane.git
cd plane

# Switch to stable release
git checkout stable

# Deploy with Docker Compose
cd docker
docker compose -f docker-compose.yml up -d
```

Wait for all services to start. Verify Plane is accessible at `http://localhost:9394`.

### Step 2: Create a Plane API Token

1. Log in to Plane at `http://localhost:9394`
2. Go to **Profile Settings** → **API Tokens**
3. Create a new token with **read/write** permissions
4. Copy the token — you'll need it in the next step

### Step 3: Clone and Configure the Extension

```bash
git clone https://github.com/YOUR_ORG/plane-pm-extension.git
cd plane-pm-extension
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PM_DATABASE_URL=postgresql+asyncpg://plane:plane@plane-db:5432/plane
PM_PLANE_BASE_URL=http://api:8000
PM_PLANE_API_TOKEN=your_api_token_here
PM_PLANE_WEB_URL=http://localhost:9394
PM_PLANE_WORKSPACE_SLUG=your_workspace_slug
```

### Step 4: Deploy with Docker Compose

#### Option A: Deploy alongside Plane (recommended)

Copy the extension's docker-compose into Plane's docker directory:

```bash
# From plane-pm-extension root
docker compose up -d
```

This starts:
- **pm-backend** (port 8080) — FastAPI extension service
- **pm-frontend** (port 3000) — Next.js web UI

The extension connects to Plane's existing `plane-db` and `api` services via Docker network.

#### Option B: Local Development

```bash
# Terminal 1: Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### Step 5: Access the Extension

| Service | URL |
|---|---|
| PM Extension Frontend | http://localhost:3000 |
| PM Extension API Docs | http://localhost:8080/docs |
| Plane Web UI | http://localhost:9394 |

---

## Docker Deployment

### Production docker-compose.yml

See [deploy/docker-compose.yml](deploy/docker-compose.yml) for the full production configuration.

Key settings:
- Backend uses `--no-reload` for production
- Frontend runs `next build && next start`
- Connects to Plane's Docker network (`plane-app_default`)
- Health checks for all services

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PM_DATABASE_URL` | `postgresql+asyncpg://plane:plane@plane-db:5432/plane` | Extension DB connection |
| `PM_PLANE_BASE_URL` | `http://api:8000` | Plane API internal URL |
| `PM_PLANE_API_TOKEN` | *(required)* | Plane API authentication token |
| `PM_PLANE_WEB_URL` | `http://localhost:9394` | Plane web UI URL |
| `PM_PLANE_WORKSPACE_SLUG` | *(required)* | Your Plane workspace slug |
| `PM_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |
| `PM_SYNC_INTERVAL_MINUTES` | `5` | Data sync interval |

---

## Project Structure

```
plane-pm-extension/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM models
│   │   │   ├── project_ext.py
│   │   │   ├── workitem_ext.py
│   │   │   ├── resource.py
│   │   │   ├── dependency.py
│   │   │   ├── baseline.py
│   │   │   ├── calendar.py
│   │   │   └── evm.py
│   │   ├── routers/         # FastAPI route handlers
│   │   │   ├── projects.py
│   │   │   ├── gantt.py
│   │   │   ├── resources.py
│   │   │   ├── baseline.py
│   │   │   └── evm.py
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic
│   │   │   ├── cpm_engine.py     # Critical Path Method
│   │   │   ├── evm_engine.py     # Earned Value calculations
│   │   │   ├── wbs_builder.py    # WBS tree construction
│   │   │   └── plane_client.py   # Plane API client
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── gantt/page.tsx      # Gantt chart page
│   │   │   ├── wbs/page.tsx        # WBS page
│   │   │   ├── resources/page.tsx  # Resource management
│   │   │   └── evm/page.tsx        # EVM dashboard
│   │   ├── components/
│   │   │   ├── GanttChart.tsx       # DHTMLX Gantt wrapper
│   │   │   ├── WBSTree.tsx         # WBS tree component
│   │   │   ├── PivotFilter.tsx     # Excel-style filter
│   │   │   ├── ResourceTimelineView.tsx
│   │   │   └── InlineEdit.tsx      # Inline editing
│   │   └── lib/
│   │       └── api.ts              # API client
│   ├── Dockerfile
│   └── package.json
├── deploy/
│   └── docker-compose.yml
├── LICENSE
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS 4 |
| Charts | DHTMLX Gantt 8, ECharts 5 |
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic 2 |
| Database | PostgreSQL 15 (shared with Plane) |
| API Client | httpx (async) |
| Scheduler | APScheduler |
| Containerization | Docker, Docker Compose |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see [LICENSE](LICENSE) for details.

This means:
- You can **use** this software for any purpose
- You can **modify** and **distribute** it
- Modified versions must also be released under AGPL-3.0
- If you run it on a server, users must be able to download the source

## Acknowledgments

- [Plane](https://plane.so) — Open-source project management platform
- [DHTMLX Gantt](https://dhtmlx.com/software/gantt/) — Gantt chart component
- [ECharts](https://echarts.apache.org/) — Visualization library
