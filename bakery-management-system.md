# Bakery Management System — Full Breakdown

## Overview

This is a **two-surface system** built on a single shared codebase. The Windows desktop app and the remote web dashboard are both React — they share UI components, business logic, and type definitions. Everything talks to one central on-premise server at the bakery.

---

## System Architecture

```
[ Windows Desktop App ]  <-->  [ On-Premise Server ]  <-->  [ Web Dashboard ]
  Electron + React               Node.js + PostgreSQL          Next.js (React)
  Used by staff in-shop          Runs on local server           Accessed via browser
                                 Exposed via Cloudflare Tunnel  from anywhere
```

The on-premise server is the single source of truth. The web dashboard accesses it remotely via a **Cloudflare Tunnel** — no cloud database subscription, no port forwarding, no VPN required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop App | Electron + React (TypeScript) |
| Web Dashboard | Next.js (React, TypeScript) |
| Backend API | Node.js + Express (or Fastify) |
| Database | PostgreSQL |
| Real-time | Socket.io (WebSockets) |
| Authentication | JWT + role-based middleware |
| Remote Access | Cloudflare Tunnel |
| Monorepo Tooling | Turborepo |
| Desktop Packaging | electron-builder + electron-updater |

---

## Windows Desktop App — Electron + React

Electron wraps a React app into a true native Windows executable. Staff at the shop use this daily.

### Modules

**POS & Sales**
- Process orders and multiple payment methods
- Receipt printing via thermal printer
- End-of-day cash reconciliation

**Inventory Management**
- Raw material tracking and real-time stock levels
- Manual stock adjustments and low-stock warnings

**Batch Production**
- Log production runs for finished goods
- Track daily production targets and actuals

**Supplier Management**
- Supplier profiles and purchase orders
- Delivery confirmations and restock history

**Expense Tracking**
- Log daily operational costs (utilities, wages, packaging, ingredients)

**Financial Reports**
- Daily sales summaries and P&L snapshots
- Exportable as PDF or Excel

**Role-gated UI**
- Menu items and actions are hidden or locked based on the logged-in user's role

---

## Web Dashboard — Next.js

A browser-based interface the owner can access from anywhere — phone, laptop, tablet. Read-only by design. Shares React components directly with the desktop app.

### What the Owner Sees

- Live sales figures updating in real time via WebSocket
- Current stock levels with visual low-stock indicators
- Active and completed production orders for the day
- Daily revenue, expenses, and profit/loss summary

---

## Backend — Node.js + PostgreSQL

The on-premise server runs on a dedicated machine at the bakery 24/7 and is the single source of truth for all data.

**Why PostgreSQL?** It handles concurrent writes from multiple POS terminals cleanly, supports complex financial queries natively, and scales without cost as the bakery grows.

**Why Cloudflare Tunnel?** The owner gets a secure `https://yourdomain.com` URL pointing at the on-premise server — no public IP, no port forwarding, no VPN. It is free and nearly zero-maintenance after initial setup.

---

## User Roles & Permissions

| Action | Admin | Cashier | Baker | Owner (web) |
|---|---|---|---|---|
| Process sales | ✅ | ✅ | ❌ | 👁️ view |
| View inventory | ✅ | ✅ | ✅ | 👁️ view |
| Edit inventory | ✅ | ❌ | ❌ | ❌ |
| Log production | ✅ | ❌ | ✅ | 👁️ view |
| Manage suppliers | ✅ | ❌ | ❌ | ❌ |
| View reports | ✅ | ❌ | ❌ | 👁️ view |
| Manage users | ✅ | ❌ | ❌ | ❌ |

---

## Folder Structure

```
bakery-system/
├── apps/
│   ├── desktop/          # Electron shell + main process
│   ├── web/              # Next.js dashboard
│   └── server/           # Node.js API + WebSocket server
├── packages/
│   ├── ui/               # Shared React components
│   ├── types/            # Shared TypeScript interfaces
│   └── utils/            # Shared business logic (e.g. stock calc)
└── package.json          # Monorepo root (Turborepo)
```

A **monorepo with Turborepo** lets the desktop app and web dashboard share components and types without duplication, while keeping each app independently deployable.

---

## Delivery Phases

### Phase 1 — Core (8–10 weeks)
- POS & sales module
- Inventory management
- User authentication and role-based access
- Basic reporting (daily sales summary)
- On-premise server setup
- Cloudflare Tunnel configuration

### Phase 2 — Production & Suppliers (4–5 weeks)
- Production batch logging
- Daily production targets tracking
- Supplier profiles and purchase orders

### Phase 3 — Remote Dashboard & Financials (4–5 weeks)
- Next.js web dashboard
- Live WebSocket feed (sales, stock, production)
- Expense tracking
- Profit & loss overview
- PDF and Excel report exports

**Total estimated timeline: 16–20 weeks**

---

## Key Questions to Confirm With the Client

1. **Dedicated server machine** — is there a PC at the bakery that can run 24/7, or does one need to be budgeted for?
2. **Thermal receipt printer** — does the client have one, and what model? (Affects driver integration)
3. **Number of POS terminals** — how many Windows machines will run the desktop app simultaneously?
4. **Domain name** — needed for the Cloudflare Tunnel URL the owner uses remotely
5. **Internet connection at the bakery** — Cloudflare Tunnel requires a stable outbound connection

---

*Prepared for client discussion. Stack: Electron + React + Node.js + PostgreSQL + Next.js*
