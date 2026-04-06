# KetoKid Care

## Overview

A medical management system for children on ketogenic diets. Consists of a doctor-facing web dashboard and a mobile app prototype.

## Architecture

- **Frontend**: React 19 + Vite doctor dashboard (port 5000)
- **Backend**: Express 5 API server (port 8080)
- **Database**: PostgreSQL with Drizzle ORM
- **Package Manager**: pnpm workspaces monorepo (in `admin website/`)
- **API Layer**: OpenAPI 3.1 + Orval codegen (React Query hooks + Zod schemas)

## Project Layout

```
admin website/          # pnpm monorepo
  artifacts/
    api-server/         # Express backend (PORT=8080)
    doctor-dashboard/   # React+Vite frontend (PORT=5000)
  lib/
    api-spec/           # OpenAPI spec + Orval config
    api-client-react/   # Generated React Query hooks
    api-zod/            # Generated Zod schemas
    db/                 # Drizzle ORM schema + DB connection
  scripts/              # Utility scripts

Mobile App/             # HTML mockups for parent mobile interface
```

## Development Workflows

- **Start application**: Runs the React doctor dashboard on port 5000
- **API Server**: Runs the Express API server on port 8080

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (auto-provisioned by Replit)

## Key Commands

```bash
cd 'admin website'
pnpm install                                      # Install dependencies
pnpm --filter @workspace/db run push              # Push DB schema
pnpm --filter @workspace/doctor-dashboard run dev # Run frontend dev server
pnpm --filter @workspace/api-server run dev       # Run API dev server
```
