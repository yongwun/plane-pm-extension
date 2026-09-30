# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-30

### Added
- **Gantt Chart**: Interactive timeline with DHTMLX Gantt, drag-and-drop scheduling
- **CPM Engine**: Critical Path Method with forward/backward pass calculation
- **Dependency Management**: FS, FF, SS, SF dependency types with lag
- **WBS View**: Hierarchical task tree with inline editing
- **Resource Management**: Project-based resource pool CRUD and allocation
- **Resource View**: Cross-project allocation summary with category grouping
- **Resource Timeline**: Day-by-day utilization heatmap (Gantt-style)
- **Pivot Filter**: Excel-style multi-level filter with search and select-all
- **EVM Dashboard**: PV/EV/AC/SPI/CPI metrics with S-Curve chart
- **Baseline Management**: Save and compare project baselines
- **Dark/Light Theme**: Theme toggle with persistent preference
- **Docker Deployment**: Production docker-compose for alongside Plane
- **API Documentation**: Auto-generated Swagger/OpenAPI docs at /docs

### Technical
- FastAPI backend with async SQLAlchemy
- Next.js 15 + React 19 frontend
- PostgreSQL shared with Plane instance
- Plane API integration via httpx async client
