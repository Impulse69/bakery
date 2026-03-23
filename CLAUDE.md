# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bakery management system — a two-surface app (Windows desktop for staff, web dashboard for owner) backed by a single on-premise Node.js server. Full design spec lives in `bakery-management-system.md`.

## Architecture

- **apps/desktop** — Electron + React (TypeScript). In-shop POS, inventory, production, reports.
- **apps/web** — Next.js (TypeScript). Read-only owner dashboard with live WebSocket updates.
- **apps/server** — Node.js API + Socket.io. Single source of truth. PostgreSQL database. Exposed remotely via Cloudflare Tunnel.
- **packages/types** — Shared TypeScript interfaces across all apps.
- **packages/ui** — Shared React components used by both desktop and web.
- **packages/utils** — Shared business logic (stock calculations, etc.).

Desktop and web share UI components and types; server shares only types and utils with the frontends.

## Build & Dev Commands

```bash
npm run build          # Build all workspaces (turbo)
npm run dev            # Dev mode for all workspaces (turbo, persistent)
npm run lint           # Lint all workspaces
npm run clean          # Clean build outputs

# Single workspace
npx turbo run build --filter=@bakery/server
npx turbo run dev --filter=@bakery/desktop
```

Turborepo v2 config — uses `tasks` (not `pipeline`) in `turbo.json`.

## Monorepo Workspace Names

`@bakery/desktop`, `@bakery/web`, `@bakery/server`, `@bakery/types`, `@bakery/ui`, `@bakery/utils`

## Workflow Standards

### Workflow Orchestration
#### 1. Plan Mode Default
- Enter plan mode for ANY non‑trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re‑plan immediately – don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

#### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One tack per subagent for focused execution.

#### 3. Self‑Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project.

#### 4. Verification Before Done
- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

#### 5. Demand Elegance (Balanced)
- For non‑trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution".
- Skip this for simple, obvious fixes – don't over‑engineer.
- Challenge your own work before presenting it.

#### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand‑holding.
- Point at logs, errors, failing tests – then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.

### Task Management
1. *Plan First*: Write plan to tasks/todo.md with checkable items.
2. *Verify Plan*: Check in before starting implementation.
3. *Track Progress*: Mark items complete as you go.
4. *Explain Changes*: High‑level summary at each step.
5. *Document Results*: Add review section to tasks/todo.md after corrections.
6. *Capture Lessons*: Update tasks/lessons.md.

### Core Principles
- *Simplicity First*: Make every change as simple as possible. Impact minimal code.
- *No Laziness*: Find root causes. No temporary fixes. Senior developer standards.
- *Minimal Impact*: Changes should only touch what's necessary. Avoid introducing bugs.

## User Roles

Admin, Cashier, Baker, Owner (web-only, read-only). Role-permission matrix in `bakery-management-system.md`.

## Current State

Project is scaffolded — workspace wiring and Turbo pipeline are configured. Source code implementation has not started yet.
