# Learning Ledger: Bakery Management System

## Key Lessons
*(To be populated as work progresses and feedback is received)*

- **Workflow Orchestration**: Following `Workflow.md` for task planning and verification.
- **Architectural Clarity**: Separating Desktop (Electron) and Web (Next.js) while sharing UI packages.
- **Turborepo v2 Configuration**:
  - Turborepo >= v2 requires configuring the root `package.json` with the `packageManager` field (e.g. `"packageManager": "npm@10.8.2"`).
  - The configuration object in `turbo.json` uses `tasks` instead of `pipeline`.