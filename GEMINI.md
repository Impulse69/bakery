# Bakery Management System - Gemini Assistant Directives

This document provides foundational mandates, architectural context, and workflow standards for the Gemini CLI assistant when working in this repository. 

## 1. Project Overview & Architecture

The Bakery Management System is a monorepo containing a Windows desktop application for in-shop use, a web dashboard for remote monitoring, and a central on-premise server.

**Monorepo Workspaces (`turbo.json` managed):**
- **`@bakery/desktop`** (`apps/desktop`): Electron + React (Vite, TypeScript). In-shop POS, inventory, production, and reports.
- **`@bakery/server`** (`apps/server`): Node.js + Express API + Socket.io. Single source of truth backed by PostgreSQL (Prisma ORM). Exposed remotely via Cloudflare Tunnel.
- **`@bakery/web`** (`apps/web`): Next.js (TypeScript). Read-only owner dashboard with live WebSocket updates.
- **`@bakery/types`** (`packages/types`): Shared TypeScript interfaces across all apps.
- **`@bakery/ui`** (`packages/ui`): Shared React components using CSS Modules. Consumed directly via source (`src/index.ts`) without a build step.
- **`@bakery/utils`** (`packages/utils`): Shared business logic, permissions, and formatting.

## 2. Key Technologies & Design Decisions

- **Frontend:** React, Next.js, Electron, Framer Motion, CSS Modules (`bui-` prefix design tokens in `packages/ui/src/styles/variables.css`).
- **Backend:** Node.js, Express, Prisma, PostgreSQL, Socket.io.
- **Styling Encapsulation:** Always use CSS Modules for component-level styling.
- **Real-time:** The system relies on Socket.io for live updates between the server and all clients.
- **Database Rules:**
  - All database changes must be handled via Prisma migrations in `apps/server/prisma/schema.prisma`.
  - Important mappings: `PaymentMethod` enum (cash, momo, card, credit); `StockAdjustment` maps to `StockMovement` table via `@@map()`.
- **Desktop UI Considerations:** 
  - Login page features a full-screen background (`login-bg.png`) with a dark overlay and logo (`logo.png`).
  - POS product cards use a two-tier image system (`ProductGrid.tsx`): precise product name matching first, falling back to category icons.

## 3. Build & Development Commands

From the monorepo root:
```bash
npm run dev            # Start all workspaces in parallel (persistent dev mode)
npm run build          # Build all workspaces
npm run lint           # Lint across the monorepo
npm run clean          # Remove build artifacts and caches (fixes turbo cache issues)
```

Targeting specific workspaces (e.g., server or desktop):
```bash
npx turbo run build --filter=@bakery/server
npx turbo run dev --filter=@bakery/desktop
```

## 4. Database Commands (Prisma)

**Crucial:** All Prisma commands must be executed from within the `apps/server` directory.

```bash
cd apps/server
npx prisma migrate dev      # Create and apply pending migrations
npx prisma generate         # Regenerate Prisma client after schema changes
npx prisma studio           # Open web GUI for database management
npm run db:seed             # Seed initial database data
```
Required environment variables in `apps/server/.env`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT`.

## 5. Gemini Workflow Standards

As a Gemini CLI agent, you must strictly adhere to the following workflow principles:

- **Strategic Orchestration:** Use subagents (e.g., `generalist`, `codebase_investigator`) for broad research, parallel analysis, or bulk edits to preserve your main context window.
- **Plan Mode for Complexity:** Use the `enter_plan_mode` tool for any non-trivial tasks, architectural decisions, or multi-file refactors. Do not dive into execution without a verified strategy.
- **Empirical Verification:** Never mark a task complete or state that it is fixed without empirical proof. Run tests, check logs, or write reproduction scripts to validate correctness.
- **Simplicity & Elegance:** Prefer the simplest solution that minimally impacts the codebase. Avoid over-engineering, but pause to ensure the solution aligns cleanly with the existing architecture.
- **Self-Correction:** If a plan fails or errors occur, stop and reassess the strategy. Do not forcefully retry the same failing approach. Update `tasks/todo.md` and `tasks/lessons.md` to track progress and prevent recurring mistakes.
- **Monorepo Discipline:** Place shared logic in the appropriate `packages/` workspace rather than duplicating code across apps. Ensure type safety using `@bakery/types`.

## 6. Troubleshooting

- **Merge Conflicts:** Pay extra attention to merge markers in large TSX files, particularly within `apps/desktop/src/renderer/pages/`.
- **Caching Issues:** If dependency changes aren't reflecting, run `npm run clean` and then `npm install` to clear Turborepo caches.
