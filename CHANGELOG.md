# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-04-23

### Security
- Removed hardcoded `JWT_SECRET` fallback — server now exits if env var is missing
- Removed hardcoded `DATABASE_URL` fallback — server now throws if env var is missing
- Restricted CORS from wildcard (`*`) to configurable allowed origins via `ALLOWED_ORIGINS`
- Added rate limiting on `/api/auth/login` (10 attempts per 15 minutes)
- Added Helmet middleware for HTTP security headers (CSP, X-Frame-Options, HSTS, etc.)
- Removed suspicious `prism` package from root dependencies (source of 9/15 vulnerabilities)
- Updated `vite` to 8.0.10 to patch 6 high-severity vulnerabilities
- Upgraded desktop React from 18.3.1 to 19.2.4 to align with web/ui ecosystem
- Removed debug/destructive scripts from source (`clear-all-dbs.js`, `fix-login.ts`, etc.)

### Added
- Integration test suite with Vitest and Supertest (7 tests covering auth, sales, stock)
- Structured logging with Pino (replaces `console.log` throughout server)
- `.env.example` documenting all required environment variables
- `README.md` with architecture overview, setup instructions, and API reference
- This `CHANGELOG.md`

### Fixed
- N+1 query in customer stats endpoint (batched product lookups)
- `@bakery/web` lint script (replaced broken `next lint` with `tsc --noEmit`)
- `@bakery/types` and `@bakery/utils` lint scripts (replaced no-op `echo` with real type checking)

## [0.1.5] - 2026-04-22

### Added
- Customer analytics dashboard with vibrant color palette
- Customer dossier with spending trends and KPIs
- Real-time stock availability sync on POS terminal

### Fixed
- Sales terminal blank page on navigation
- Product availability not updating after stock depletion without tab change

## [0.1.0] - Initial Release

### Added
- Desktop POS application (Electron + React)
- Server API with PostgreSQL backend
- Web dashboard for remote monitoring
- Real-time updates via Socket.io
- Inventory management with stock tracking
- Production batch management
- Customer management with credit system
- Sales order processing with multi-payment support
- Expense tracking
- Daily/weekly reporting with profit analysis
