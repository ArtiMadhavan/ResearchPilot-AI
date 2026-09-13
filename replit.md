# ResearchPilot AI

ResearchPilot AI is a research intelligence workspace for organizing papers, reading evidence, discovering research gaps, and preparing citations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/researchpilot/` — primary React + Vite product surface
- `artifacts/researchpilot/src/App.tsx` — local product state, seeded research content, routes, and interactions
- `artifacts/researchpilot/src/index.css` — ResearchPilot visual system and responsive layout rules
- `lib/api-spec/openapi.yaml` — shared API contract source of truth
- `artifacts/api-server/` — shared Express API service
- `artifacts/mockup-sandbox/` — reusable design preview surface

## Architecture decisions

- The first product surface is frontend-first so the core research workflow can be evaluated without external credentials or setup.
- Seeded content is intentionally shaped like an active research workspace, making dashboard, library, reader, intelligence, citations, and chat states useful on first load.
- ResearchPilot uses an ink-and-parchment visual language with gold evidence accents to distinguish the product from generic dashboard templates.
- The shared API and database packages remain available for the next persistence phase; the current interface keeps local interactions fast and demonstrable.

## Product

- Dashboard overview of reading progress, evidence threads, saved citations, and research activity
- Searchable and filterable paper library with favorites, paper details, and tags
- Paper reader with extracted evidence, notes, and reading progress
- Research intelligence workspace for gaps, comparisons, and roadmap ideas
- Citation studio with APA, IEEE, and MLA formatting plus copy/export actions
- Grounded chat workspace for asking questions against the library
- Workspace settings with appearance, notification, and citation preferences

## User preferences

No additional preferences recorded.

## Gotchas

- The frontend is served by the managed `artifacts/researchpilot: web` workflow and expects workflow-provided `PORT` and `BASE_PATH`.
- When backend contracts are added, update `lib/api-spec/openapi.yaml` first and regenerate the typed clients before wiring UI requests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
