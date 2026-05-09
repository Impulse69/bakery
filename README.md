# Bakery Management System

A full-stack monorepo for managing bakery operations — point-of-sale, inventory, production, and real-time analytics.

## Architecture

| Workspace | Path | Description |
|---|---|---|
| `@bakery/desktop` | `apps/desktop` | Electron + React POS application for in-shop use |
| `@bakery/server` | `apps/server` | Node.js + Express API with PostgreSQL (Prisma ORM) |
| `@bakery/web` | `apps/web` | Next.js dashboard for remote monitoring |
| `@bakery/types` | `packages/types` | Shared TypeScript interfaces |
| `@bakery/ui` | `packages/ui` | Shared React component library (CSS Modules) |
| `@bakery/utils` | `packages/utils` | Shared business logic and utilities |

## Tech Stack

- **Frontend:** React 19, Next.js, Electron, Framer Motion, CSS Modules
- **Backend:** Node.js, Express 5, Prisma 7, PostgreSQL, Socket.io
- **Build:** Turborepo, Vite 8, electron-vite
- **Security:** Helmet, bcryptjs, JWT, CORS restriction, rate limiting

## Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 15
- npm ≥ 10

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/impulse69/bakery.git
   cd bakery
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp apps/server/.env.example apps/server/.env
   # Edit .env with your database URL, JWT secret, etc.
   ```

4. **Set up the database**
   ```bash
   cd apps/server
   npx prisma migrate dev
   npm run db:seed
   ```

5. **Start development**
   ```bash
   # From monorepo root — starts all workspaces
   npm run dev
   ```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all workspaces in parallel |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint across the monorepo |
| `npm run clean` | Remove build artifacts and caches |

### Server-specific (run from `apps/server`)

| Command | Description |
|---|---|
| `npx prisma migrate dev` | Create and apply pending migrations |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma studio` | Open database GUI |
| `npm run db:seed` | Seed initial data |
| `npm test` | Run integration tests |

## Environment Variables

See [`apps/server/.env.example`](apps/server/.env.example) for all required variables.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `PORT` | — | Server port (default: 3001) |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS origins |
| `LOG_LEVEL` | — | Pino log level (default: debug/info) |

## API Endpoints

All endpoints are prefixed with `/api` and require JWT authentication unless noted.

- **Auth:** `POST /auth/login` (public), `GET /auth/me`
- **Products:** `GET/POST /products`, `GET/PATCH /products/:id`
- **Customers:** `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`
- **Sales Orders:** `GET/POST /sales-orders`, `PATCH /sales-orders/:id/status`, `POST /sales-orders/:id/payments`
- **Production:** `GET/POST /production`, `PATCH /production/:id/complete`
- **Inventory:** `GET/POST /inventory`
- **Suppliers:** `GET/POST /suppliers`
- **Purchase Orders:** `GET/POST /purchase-orders`
- **Expenses:** `GET/POST /expenses`
- **Reports:** `GET /reports/daily`, `GET /reports/weekly`, `GET /reports/profit-analysis`, `GET /reports/sales-by-product`, `GET /reports/stock-adjustment`
- **Health:** `GET /health` (public)

## License

Private — All rights reserved.
