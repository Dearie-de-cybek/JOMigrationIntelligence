# JO Migration Intelligence

Migration Readiness Assessment platform + internal CRM/Case Management for **JO Education Consultant** — a skilled migration consultancy for Australia, New Zealand and Canada.

Two connected interfaces, one backend:
- **Public Applicant Platform** (`apps/web`, route group `(public)`) — learn about pathways, eventually run a guided migration-readiness assessment (Phase 2).
- **Internal Operations Platform** (`apps/web`, route group `(internal)`) — staff CRM, case management, documents, tasks (Phase 3+).

Full architecture proposal, data model, phased roadmap and open risks: see the plan this was built from, `binary-finding-moon.md` (ask whoever ran the build for the path — it lives in the Claude Code plans folder, not this repo).

**Status: Phase 1 (Foundation) implemented.** Auth (register/login/refresh/logout), RBAC, audit logging, Swagger, and a minimal web app shell with a working login/register flow. No assessment engine, CRM or case management yet — those are later phases.

## Stack

- **API** (`apps/api`): NestJS, TypeScript, Prisma, PostgreSQL, Argon2id, JWT + rotated refresh tokens, Swagger.
- **Web** (`apps/web`): Next.js (App Router), TypeScript, Tailwind CSS v4, React Hook Form + Zod, TanStack Query.
- **Shared** (`packages/schemas`): Zod schemas used by both — a validation rule is defined once.
- **No Docker.** Run a real Postgres in seconds via [pg.new](https://pg.new) (no signup needed) or point at any Postgres you already have.

## Setup

1. **Get a database.** Either:
   - Visit https://pg.new in a browser for an instant, no-signup Postgres, or
   - Use your own Postgres instance.

   Copy the connection string.

2. **Configure the API.**
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
   Paste your `DATABASE_URL` into `apps/api/.env`. The other defaults are fine for local dev (but never use them past local dev).

3. **Configure the web app.**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

4. **Install everything** (npm workspaces — one install covers `apps/api`, `apps/web` and `packages/schemas`):
   ```bash
   npm install
   ```

5. **Run migrations and seed a Super Admin:**
   ```bash
   npm run prisma:migrate
   npm run seed
   ```
   Creates one Super Admin using `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` from `apps/api/.env`.

6. **Run both apps** (two terminals):
   ```bash
   npm run dev:api   # http://localhost:4000 — Swagger at /api/docs
   npm run dev:web   # http://localhost:3000
   ```

7. Sign in at http://localhost:3000/login with the seeded Super Admin, or register a new applicant account at http://localhost:3000/register.

## Tests

```bash
npm test        # unit tests (apps/api)
npm run test:e2e  # auth/RBAC integration tests - needs a reachable DATABASE_URL
```

## Structure

```
apps/
  api/      NestJS REST API (/api/v1, Swagger at /api/docs)
  web/      Next.js app — app/(public)/... and app/(internal)/... route groups
packages/
  schemas/  Shared Zod schemas + types
```
