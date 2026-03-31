# Bakery Management System

A comprehensive monorepo for managing bakery operations, featuring a Windows desktop application for in-shop use, a web dashboard for remote monitoring, and a central on-premise server.

## Project Overview

- **Architecture:** Monorepo using **Turborepo** to manage multiple applications and shared packages.
- **Applications:**
  - **Desktop (`apps/desktop`):** Electron + React (Vite) application used by shop staff for POS, inventory, and production management.
  - **Server (`apps/server`):** Node.js + Express API server with **Prisma ORM** (PostgreSQL) and Socket.io for real-time updates.
  - **Web (`apps/web`):** Next.js dashboard for remote access by the owner.
- **Shared Packages:**
  - **Types (`packages/types`):** Shared TypeScript interfaces and types.
  - **UI (`packages/ui`):** Shared React components using CSS Modules.
  - **Utils (`packages/utils`):** Shared business logic, formatting, and helper functions.

## Key Technologies

- **Frontend:** React, Next.js, Electron, Framer Motion, CSS Modules.
- **Backend:** Node.js, Express, Prisma, PostgreSQL, Socket.io.
- **Tooling:** Turborepo, Vite, TypeScript, Cloudflare Tunnel (for remote access).

## Building and Running

### Prerequisites

- Node.js (v18+)
- PostgreSQL (running locally for the server)

### Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Database Setup:**
    Navigate to `apps/server` and run:
    ```bash
    npm run db:migrate
    npm run db:seed
    ```

3.  **Run Development Mode:**
    From the root directory:
    ```bash
    npm run dev
    ```
    This will start the desktop app, server, and web dashboard in parallel using Turbo.

### Key Commands

- `npm run build`: Build all applications.
- `npm run lint`: Run linting across the monorepo.
- `npm run clean`: Remove build artifacts and caches.

## Development Conventions

- **Monorepo Structure:** Always prefer adding shared logic to the appropriate package in `packages/` instead of duplicating it across apps.
- **Type Safety:** Use the `@bakery/types` package for all shared data structures.
- **Styling:** Use **CSS Modules** for component-level styling to ensure encapsulation.
- **Real-time:** Use the shared Socket.io configuration for live updates between the server and clients.
- **Database:** All database changes must be handled via Prisma migrations in `apps/server/prisma/schema.prisma`.

## Troubleshooting

- **Merge Conflicts:** Be cautious of merge markers in large TSX files, especially in `apps/desktop/src/renderer/pages/`.
- **Turbo Cache:** If you encounter unexpected behavior after dependency changes, try `npm run clean` followed by `npm install`.
