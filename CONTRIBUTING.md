# Contributing to Plane PM Extension

Thank you for your interest in contributing! This document provides guidelines and information.

## Code of Conduct

By participating, you agree to maintain a respectful and inclusive environment.

## How to Contribute

### Reporting Bugs

1. Check existing [Issues](../../issues) first
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots if applicable
   - Environment details (Docker version, browser, OS)

### Suggesting Features

1. Open a [Discussion](../../discussions) first for larger features
2. Explain the use case and motivation
3. Consider implementation complexity

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the coding conventions
4. Add/update tests if applicable
5. Ensure all checks pass
6. Submit a PR with a clear description

## Development Setup

### Local Backend Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Local Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Code Style

- **Python**: Follow PEP 8, use type hints, keep functions focused
- **TypeScript**: Use strict mode, prefer functional components with hooks
- **Commits**: Use conventional commits format

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Scopes: `gantt`, `wbs`, `resource`, `evm`, `baseline`, `api`, `ui`

Example:
```
feat(resource): add cross-project utilization heatmap

- Add histogram endpoint for daily resource utilization
- Create ResourceTimelineView component with color-coded cells
- Add PivotFilter for large resource lists (500+)
```

## Architecture Guidelines

### Backend

- **Models**: SQLAlchemy async ORM, one file per domain entity
- **Routers**: FastAPI routers, group by feature domain
- **Services**: Business logic separate from HTTP handlers
- **Schemas**: Pydantic models for request/response validation

### Frontend

- **Pages**: Next.js App Router, one page per feature
- **Components**: Reusable React components in `src/components/`
- **API Client**: Centralized in `src/lib/api.ts`
- **Styling**: TailwindCSS utility classes

## Testing

```bash
# Backend tests (from backend/)
pytest

# Frontend type check
cd frontend && npx tsc --noEmit
```

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
