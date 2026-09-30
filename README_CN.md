# Plane PM Extension — 中文说明

> **[Plane](https://github.com/makeplane/plane) 项目管理扩展插件** — 为你的 Plane 自托管实例添加专业级项目管理功能（甘特图、WBS、挣值分析、资源管理），达到 ProjectLibre / Microsoft Project 级别。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](#)
[![Plane](https://img.shields.io/badge/Plane-Self--Hosted-purple)](https://plane.so)

📖 [English README](README.md) | [功能截图](SCREENSHOTS.md)

---

## 项目简介

Plane PM Extension 是 [Plane](https://plane.so)（自托管版）的扩展应用，为 Plane 补充了桌面级项目管理工具（如 Microsoft Project、ProjectLibre）中的高级功能：

| 功能模块 | 说明 |
|---------|------|
| **甘特图** | 交互式时间线，拖拽排程，依赖箭头，关键路径高亮 |
| **WBS（工作分解结构）** | 层级任务树，行内编辑工期/日期/进度/里程碑 |
| **资源管理** | 跨项目资源分配、利用率热力图、产能规划 |
| **EVM（挣值管理）** | PV/EV/AC/SPI/CPI 指标，S 曲线图表 |
| **基线管理** | 保存并对比项目基线（计划 vs 实际） |
| **CPM 引擎** | 关键路径法，正推/逆推计算 |

<p align="center">
  <img src="docs/screenshots/01-homepage.png" alt="主页" width="800">
</p>

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                  浏览器 (localhost:3000)                   │
│             Next.js 15 + React 19 + TailwindCSS 4       │
├─────────────────────────────────────────────────────────┤
│             PM Extension API (localhost:8080)             │
│                 FastAPI + SQLAlchemy (异步)                │
├────────────────────────┬────────────────────────────────┤
│   Plane API (:8000)    │    PostgreSQL (:5432)            │
│   (REST 读写接口)       │    (扩展数据表)                   │
└────────────────────────┴────────────────────────────────┘
         ▲
         │
┌────────┴────────────────────────────────────────────────┐
│              Plane 自托管 (Docker 容器组)                  │
│   Web UI (:9394) │ API │ Worker │ DB │ Redis │ MQ      │
└─────────────────────────────────────────────────────────┘
```

**工作原理**：
- 前端（Next.js）通过 REST API 与扩展后端（FastAPI）通信
- 后端同时连接 Plane API（读写项目/任务数据）和 PostgreSQL（存储扩展数据，如资源分配、基线、依赖关系等）
- 扩展数据表与 Plane 的数据表共存于同一个 PostgreSQL 数据库
- 通过 Docker 网络与 Plane 的容器组互联

---

## 功能详情

### 1. 甘特图 (Gantt Chart)

基于 [DHTMLX Gantt 8](https://dhtmlx.com/software/gantt/) 的交互式甘特图：

- **拖拽排程**：拖动任务条调整开始/结束日期
- **依赖关系**：支持 FS（完成-开始）、FF（完成-完成）、SS（开始-开始）、SF（开始-完成）四种依赖类型，可设置滞后时间
- **关键路径**：CPM 引擎自动计算关键路径，红色高亮显示
- **进度显示**：每个任务条内嵌进度条
- **里程碑**：菱形标记关键节点
- **基线对比**：叠加显示基线计划 vs 当前进度
- **行内编辑**：直接修改任务名称、工期、进度百分比

<p align="center">
  <img src="docs/screenshots/02-gantt-chart.png" alt="甘特图" width="800">
</p>

### 2. WBS（工作分解结构）

树形结构的任务分解视图：

- **层级展示**：可展开/折叠的树形表格
- **行内编辑**：直接在行内修改工期、开始日期、完成百分比、是否里程碑
- **任务操作**：新增子任务、删除任务、调整层级
- **编辑锁定**：🔒/✏️ 切换按钮，防止误操作

<p align="center">
  <img src="docs/screenshots/03-wbs.png" alt="WBS" width="800">
</p>

### 3. 资源管理

三个视图 Tab，覆盖资源管理全场景：

#### 📋 项目视角
- 按项目管理资源池（人力/设备/材料/费用）
- 资源 CRUD（增删改查）
- 将资源分配到任务，设置分配比例

<p align="center">
  <img src="docs/screenshots/04-resources-project.png" alt="资源管理-项目视角" width="800">
</p>

#### 👤 资源视角
- 跨项目汇总：查看每个资源被分配到了哪些项目
- **按类别分组**：人力、设备、材料、费用四大类，可折叠
- **超负荷检测**：自动标记利用率 > 100% 的资源（红色警告）
- **PivotFilter 筛选器**：Excel 数据透视表风格
  - 文字搜索（输入即过滤）
  - 全选 / 全不选（一键操作）
  - 可滚动列表（支持 500+ 资源）
  - 利用率百分比徽章

<p align="center">
  <img src="docs/screenshots/05-resources-resource.png" alt="资源管理-资源视角" width="800">
</p>

#### 📊 时间线
- 每日利用率热力图（甘特风格）
- 固定左列（资源名称）+ 可滚动右侧（时间网格）
- 颜色编码：🟢 空闲 → 🟡 部分分配 → 🟠 满载 → 🔴 超负荷 → ⬜ 周末
- 鼠标悬停 Tooltip 显示详细数据
- 今日竖线标记
- 底部合计行

<p align="center">
  <img src="docs/screenshots/06-resources-timeline.png" alt="资源管理-时间线" width="800">
</p>

### 4. EVM（挣值管理）

项目绩效分析仪表板：

- **三大指标**：PV（计划值）、EV（挣值）、AC（实际成本）
- **绩效指标**：SPI（进度绩效指数）、CPI（成本绩效指数）
- **预测指标**：EAC（完工估算）、ETC（剩余估算）、VAC（完工偏差）
- **S 曲线图**：ECharts 可视化 PV/EV/AC 随时间变化
- **状态指示器**：SPI > 1 绿色（超前）/ SPI < 1 红色（滞后）

<p align="center">
  <img src="docs/screenshots/07-evm.png" alt="EVM 挣值管理" width="800">
</p>

### 5. 基线管理

- **保存基线**：将当前项目计划快照保存为基线
- **对比分析**：当前计划 vs 基线，偏差一目了然
- **多基线支持**：可保存多个基线版本

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Next.js 15 + React 19 | App Router，客户端渲染 |
| **UI 样式** | TailwindCSS 4 | 实用优先的 CSS 框架，暗色模式 |
| **甘特图** | DHTMLX Gantt 8 | 专业级甘特图组件 |
| **图表** | ECharts 5 + echarts-for-react | S 曲线、柱状图 |
| **图标** | Lucide React | 轻量级图标库 |
| **后端框架** | FastAPI | 高性能异步 Web 框架 |
| **ORM** | SQLAlchemy 2 (async) | 异步数据库访问 |
| **数据验证** | Pydantic 2 | 请求/响应数据校验 |
| **HTTP 客户端** | httpx (async) | 异步调用 Plane API |
| **任务调度** | APScheduler | 定期数据同步 |
| **图算法** | NetworkX | CPM 关键路径计算 |
| **数据库** | PostgreSQL 15 | 与 Plane 共享实例 |
| **容器化** | Docker + Docker Compose | 一键部署 |

---

## 快速开始

### 前提条件

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| **Docker + Docker Compose** | 24+ / 2.20+ | [安装 Docker](https://docs.docker.com/engine/install/) |
| **Plane 自托管** | 最新稳定版 | 运行在 `localhost:9394` |
| **Node.js** | 20+ | 仅本地前端开发需要 |
| **Python** | 3.12+ | 仅本地后端开发需要 |

### 第一步：部署 Plane（如已有可跳过）

参照 [Plane 官方 Docker 部署文档](https://docs.plane.so/self-hosting/methods/docker-compose)：

```bash
# 克隆 Plane
git clone https://github.com/makeplane/plane.git
cd plane

# 切换到稳定版
git checkout stable

# Docker Compose 部署
cd docker
docker compose -f docker-compose.yml up -d
```

等待所有服务启动，访问 `http://localhost:9394` 确认 Plane 可用。

### 第二步：获取 Plane API Token

1. 登录 Plane（`http://localhost:9394`）
2. 进入 **个人设置（Profile Settings）** → **API Tokens**
3. 创建新 Token，勾选 **读写权限**
4. 复制 Token（下一步会用到）

### 第三步：克隆并配置扩展

```bash
git clone https://github.com/yongwun/plane-pm-extension.git
cd plane-pm-extension
```

创建后端环境配置文件：

```bash
# Linux/Mac
cp backend/.env.example backend/.env

# Windows PowerShell
Copy-Item backend\.env.example backend\.env
```

编辑 `backend/.env`，填入你的 Plane 信息：

```env
# 数据库（与 Plane 共享 PostgreSQL）
PM_DATABASE_URL=postgresql+asyncpg://plane:plane@plane-db:5432/plane

# Plane API 内部地址（Docker 网络内）
PM_PLANE_BASE_URL=http://api:8000

# ⚠️ 必填：第二步获取的 API Token
PM_PLANE_API_TOKEN=你的API_Token

# Plane Web UI 地址
PM_PLANE_WEB_URL=http://localhost:9394

# ⚠️ 必填：你的 Plane 工作区 slug（URL 中的那一段）
PM_PLANE_WORKSPACE_SLUG=你的工作区slug
```

### 第四步：启动服务

#### 方式 A：Docker Compose 部署（推荐）

确保 Plane 的 Docker 容器正在运行，然后：

```bash
# 配置部署环境变量
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，填入 PM_PLANE_API_TOKEN 和 PM_PLANE_WORKSPACE_SLUG

# 启动扩展服务
docker compose -f deploy/docker-compose.yml up -d
```

这会启动两个容器：
- **pm-backend**（端口 8080）— FastAPI 后端
- **pm-frontend**（端口 3000）— Next.js 前端

扩展会自动连接到 Plane 的 `plane-db` 和 `api` 服务。

#### 方式 B：本地开发

打开两个终端：

```bash
# 终端 1：后端
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# 终端 2：前端
cd frontend
npm install
npm run dev
```

### 第五步：访问

| 服务 | 地址 | 说明 |
|------|------|------|
| PM Extension 前端 | http://localhost:3000 | 主界面 |
| PM Extension API | http://localhost:8080/docs | Swagger 自动文档 |
| Plane Web UI | http://localhost:9394 | Plane 原版界面 |

### 第六步：导入测试数据（可选）

```bash
python seed_test_data.py
```

这会创建示例项目、任务、资源和分配数据，方便你快速体验各项功能。

---

## 环境变量说明

### 后端（backend/.env）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PM_DATABASE_URL` | `postgresql+asyncpg://plane:plane@plane-db:5432/plane` | 数据库连接串 |
| `PM_PLANE_BASE_URL` | `http://api:8000` | Plane API 内部地址 |
| `PM_PLANE_API_TOKEN` | *(必填)* | Plane API 认证 Token |
| `PM_PLANE_WEB_URL` | `http://localhost:9394` | Plane Web UI 地址 |
| `PM_PLANE_WORKSPACE_SLUG` | *(必填)* | Plane 工作区标识 |
| `PM_CORS_ORIGINS` | `["http://localhost:3000"]` | CORS 允许的来源 |
| `PM_DEBUG` | `true` | 调试模式 |
| `PM_SYNC_INTERVAL_MINUTES` | `5` | 数据同步间隔（分钟） |

### 前端（frontend/.env.local）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | 扩展后端 API 地址 |

### 部署（deploy/.env）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PM_PLANE_API_TOKEN` | *(必填)* | Plane API Token |
| `PM_PLANE_WORKSPACE_SLUG` | *(必填)* | 工作区标识 |
| `PM_API_BASE_URL` | `http://localhost:8080` | 前端访问的 API 地址 |
| `PLANE_NETWORK` | `plane-app_default` | Plane 的 Docker 网络名称 |

> **提示**：查看 Plane Docker 网络名称：`docker network ls | grep plane`

---

## 项目结构

```
plane-pm-extension/
├── backend/                        # 后端（Python FastAPI）
│   ├── app/
│   │   ├── models/                 # SQLAlchemy ORM 模型
│   │   │   ├── project_ext.py      #   项目扩展（关联 Plane Project）
│   │   │   ├── workitem_ext.py     #   任务扩展（关联 Plane WorkItem）
│   │   │   ├── resource.py         #   资源池 + 资源分配
│   │   │   ├── dependency.py       #   任务依赖关系
│   │   │   ├── baseline.py         #   基线快照
│   │   │   ├── calendar.py         #   工作日历
│   │   │   └── evm.py              #   挣值数据
│   │   ├── routers/                # FastAPI 路由
│   │   │   ├── projects.py         #   项目 CRUD + 设置
│   │   │   ├── gantt.py            #   甘特图数据（含 CPM 计算）
│   │   │   ├── resources.py        #   资源管理（含跨项目汇总/时间线）
│   │   │   ├── baseline.py         #   基线管理
│   │   │   └── evm.py              #   挣值分析
│   │   ├── schemas/                # Pydantic 数据模型
│   │   ├── services/               # 业务逻辑层
│   │   │   ├── cpm_engine.py       #   关键路径法（正推/逆推/浮动时间）
│   │   │   ├── evm_engine.py       #   挣值计算引擎
│   │   │   ├── wbs_builder.py      #   WBS 树形结构构建
│   │   │   └── plane_client.py     #   Plane API 异步客户端
│   │   ├── config.py               #   配置管理（pydantic-settings）
│   │   ├── database.py             #   数据库初始化
│   │   └── main.py                 #   FastAPI 应用入口
│   ├── Dockerfile                  #   后端 Docker 镜像
│   └── requirements.txt            #   Python 依赖
│
├── frontend/                       # 前端（Next.js + React）
│   ├── src/
│   │   ├── app/
│   │   │   ├── gantt/page.tsx      #   甘特图页面
│   │   │   ├── wbs/page.tsx        #   WBS 页面
│   │   │   ├── resources/page.tsx  #   资源管理页面（三视图）
│   │   │   └── evm/page.tsx        #   EVM 仪表板
│   │   ├── components/
│   │   │   ├── GanttChart.tsx      #   DHTMLX Gantt 封装组件
│   │   │   ├── WBSTree.tsx         #   WBS 树形组件
│   │   │   ├── PivotFilter.tsx     #   Excel 风格多选筛选器
│   │   │   ├── ResourceTimelineView.tsx  # 资源时间线热力图
│   │   │   ├── InlineEdit.tsx      #   行内编辑组件集合
│   │   │   ├── ThemeProvider.tsx    #   主题上下文
│   │   │   └── ThemeToggle.tsx     #   暗色/亮色切换
│   │   └── lib/
│   │       └── api.ts              #   API 客户端（类型安全）
│   ├── Dockerfile                  #   前端 Docker 镜像（多阶段构建）
│   └── package.json
│
├── deploy/                         # 部署配置
│   ├── docker-compose.yml          #   生产环境 Docker Compose
│   └── .env.example                #   部署环境变量模板
│
├── seed_test_data.py               # 测试数据导入脚本
├── LICENSE                         # AGPL-3.0 许可证
├── CONTRIBUTING.md                 # 贡献指南
├── CHANGELOG.md                    # 变更日志
├── README.md                       # 英文说明
└── README_CN.md                    # 中文说明（本文件）
```

---

## Docker 生产部署

### 部署架构

```
                    ┌──────────────────────────────┐
                    │        Docker Host            │
                    │                               │
  :3000 ◄───────────┤  pm-frontend (Next.js)        │
                    │       │                       │
  :8080 ◄───────────┤  pm-backend (FastAPI)          │
                    │       │              │         │
                    │       ▼              ▼         │
                    │  plane-api      plane-db       │
                    │  (:8000)        (:5432)        │
                    │                               │
  :9394 ◄───────────┤  plane-web                   │
                    │  + worker, redis, mq, minio  │
                    └──────────────────────────────┘
```

### 部署步骤

```bash
# 1. 确保 Plane 容器正在运行
cd /path/to/plane/docker
docker compose up -d

# 2. 克隆扩展仓库
git clone https://github.com/yongwun/plane-pm-extension.git
cd plane-pm-extension

# 3. 配置环境变量
cp deploy/.env.example deploy/.env
nano deploy/.env
# 必填项:
#   PM_PLANE_API_TOKEN=你的Token
#   PM_PLANE_WORKSPACE_SLUG=你的slug
#   PLANE_NETWORK=plane-app_default  (用 docker network ls 确认)

# 4. 构建并启动
docker compose -f deploy/docker-compose.yml up -d --build

# 5. 查看日志
docker compose -f deploy/docker-compose.yml logs -f
```

### 关键配置

- **后端**：生产模式使用 `--workers 2`（无 `--reload`）
- **前端**：多阶段构建（builder → runner），最小化镜像体积
- **健康检查**：所有服务都有 healthcheck 配置
- **自动重启**：`restart: unless-stopped`
- **网络**：通过外部网络连接 Plane 容器组

---

## 开发指南

### 后端开发

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 开发模式（热重载）
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# API 文档自动生成
# Swagger UI: http://localhost:8080/docs
# ReDoc:      http://localhost:8080/redoc
```

### 前端开发

```bash
cd frontend
npm install

# 开发模式（热重载，端口 3001）
npm run dev

# 生产构建
npm run build
npm start
```

### 代码规范

- **Python**：遵循 PEP 8，使用类型注解，函数职责单一
- **TypeScript**：严格模式，优先使用函数式组件 + Hooks
- **提交信息**：采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式

---

## 常见问题

### Q: 扩展的数据库会影响 Plane 的数据吗？

不会。扩展使用独立的数据表（`project_extensions`、`workitem_extensions` 等），通过外键关联 Plane 的表，但不会修改 Plane 的原有数据。

### Q: 如何查看 Plane 的 Docker 网络名称？

```bash
docker network ls | grep plane
```

通常是 `plane-app_default` 或 `plane_default`，将结果填入 `deploy/.env` 的 `PLANE_NETWORK`。

### Q: 前端访问后端报 CORS 错误？

检查 `backend/.env` 的 `PM_CORS_ORIGINS`，确保包含前端的地址：

```env
PM_CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

### Q: 资源时间线显示空白？

确保任务已设置了开始日期和工期。时间线的数据来自任务的分配信息 + 任务的日期范围。

---

## 许可证

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 开源协议 — 详见 [LICENSE](LICENSE)。

这意味着：
- 你可以**自由使用**本软件
- 你可以**修改和分发**本软件
- 修改后的版本也必须以 AGPL-3.0 发布
- 如果在服务器上运行，用户必须能获取源代码

## 致谢

- [Plane](https://plane.so) — 开源项目管理平台
- [DHTMLX Gantt](https://dhtmlx.com/software/gantt/) — 甘特图组件
- [ECharts](https://echarts.apache.org/) — 可视化图表库
