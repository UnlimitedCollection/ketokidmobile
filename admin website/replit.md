# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Keto Doctor Dashboard - a web dashboard for doctors managing children on ketogenic diets.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TanStack Query, Wouter, Recharts, Framer Motion

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── doctor-dashboard/   # React doctor web dashboard
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
│       └── seed.ts         # Database seed script
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with express-session for doctor authentication.

Routes:
- `GET /api/healthz` — health check
- `POST /api/auth/login` — doctor login (username/password)
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — get current doctor session
- `GET /api/dashboard/stats` — KPI stats for doctor dashboard
- `GET /api/kids` — list kids (with search and phase filter)
- `POST /api/kids` — create kid
- `GET /api/kids/:id` — kid profile with medical, weights, meals, notes
- `PUT /api/kids/:id` — update kid info
- `POST /api/kids/:id/weight` — add weight record
- `GET /api/kids/:id/weight` — weight history
- `GET/PUT /api/kids/:id/medical` — medical settings
- `GET /api/kids/:id/meal-history` — meal history
- `GET/POST /api/kids/:id/notes` — private notes
- `DELETE /api/kids/:id/notes/:noteId` — delete note
- `PUT /api/kids/:id/visibility` — food/recipe visibility settings
- `GET/POST/PUT/DELETE /api/kids/:id/meal-plans` — per-kid meal plans CRUD
- `GET/POST/DELETE /api/kids/:id/meal-plans/:planId/items` — meal plan food items
- `GET /api/foods` — list foods
- `POST /api/foods` — create food
- `PUT/DELETE /api/foods/:id` — update/delete food
- `GET/POST/DELETE /api/kids/:id/ketones` — ketone readings
- `GET/POST/DELETE /api/kids/:id/meal-logs` — per-meal log entries
- `GET /api/meal-plans` — list library meal plans (doctor-scoped)
- `POST /api/meal-plans` — create library meal plan
- `GET/PUT/DELETE /api/meal-plans/:planId` — get/update/delete library meal plan
- `POST /api/meal-plans/:planId/items` — add food item to library plan
- `DELETE /api/meal-plans/:planId/items/:itemId` — remove food item
- `GET /api/kids/:kidId/meal-plan` — get kid's currently assigned library plan (204 if none)
- `PUT /api/kids/:kidId/meal-plan` — assign or unassign a library plan to a kid

### `artifacts/doctor-dashboard` (`@workspace/doctor-dashboard`)

React + Vite web dashboard for doctors. Branded as **KetoKid Care** (rebranded from KetoCare in Task 6).

**Design system (Task 6 redesign):**
- Font: Inter (all weights), replacing Outfit/DM Sans
- Primary: #004ac6 (deep blue); Secondary: #855300 (amber); Destructive/alert: #ae0010 (red)
- Background: #f7f9fb; sidebar: fixed 256px `<aside>`, no shadcn Sidebar component
- Layout: custom fixed sidebar + sticky header, all inline SVG icons (Material-style)
- Sidebar: "KetoKid Care" wordmark, doctor profile card, 7 nav items with right-border active accent, Settings + Logout footer
- Header: rounded search input, "Quick Add" pill button, notification bell (red dot), profile icon
- Dashboard: "Clinical Overview" heading + subtitle, 4 KPI cards, Phase Distribution donut + Compliance/Weight Trend line charts, High-Risk table with severity badges (Critical/Moderate), Missing Records panel, Quick Actions grid, Recent Activity timeline

Pages:
- `/login` — Doctor login page
- `/` — Dashboard with KPI cards, phase distribution chart, high-risk kids
- `/kids` — Kids list with search and phase filter
- `/kids/new` — Add new kid form
- `/kids/:id` — Kid profile with tabs (Overview, Medical Controls, Meal History, Ketones, Meal Plan, Private Notes)
- `/high-risk` — High-risk children monitoring
- `/foods` — Food & recipe management (add/edit/deactivate foods)
- `/meal-plans` — Meal Plans Library: create/edit/delete reusable library plans with per-meal food items; assign plans to kids from their profile

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Tables:
- `doctors` — Doctor accounts (username, password, name, email, specialty, role)
- `kids` — Kid profiles (name, dob, gender, parent info, phase, currentMealPlanId)
- `medical_settings` — Medical settings per kid (keto ratio, calories, phase, visibility)
- `weight_records` — Weight measurements over time
- `meal_days` — Daily meal completion records
- `notes` — Private doctor notes per kid
- `library_meal_plans` — Doctor-scoped reusable meal plan library (name, description). Intentionally named `library_*` to distinguish from legacy per-kid `meal_plans` table. Each plan belongs to one doctor (doctorId FK) and can be assigned to multiple kids.
- `library_meal_plan_items` — Food items per library meal plan (mealType, foodName, portionGrams, macros). Companion table for `library_meal_plans`.

**Table naming note**: the legacy per-kid `meal_plans` / `meal_plan_items` tables still exist for backwards compatibility with the original per-kid meal tracking. The new `library_*` tables implement the reusable doctor-level plan library feature added in Task 5.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
Custom fetch configured with `credentials: 'include'` for session cookie support.

### `scripts` (`@workspace/scripts`)

Utility scripts. Run: `pnpm --filter @workspace/scripts run seed` to seed the database.

## Doctor Settings

The `/settings` page (accessible via the sidebar Settings link) provides:
- **Profile editing**: update name, email, username, specialty (PUT `/api/auth/profile`)
- **Password change**: current password verification + new password (PUT `/api/auth/password`)
- The sidebar Settings button is a real nav link with active-state highlighting (not disabled)

## Default Credentials (Dev)

| Role      | Username | Password   |
|-----------|----------|------------|
| admin     | admin    | 1234       |
| moderator | admin1   | 12345      |

## RBAC (Role-Based Access Control)

Two roles are supported:

- **admin** — Full CRUD access to all resources. Can manage users at `/users`. "Quick Add" and all write actions are available.
- **moderator** — Read-only access. All POST/PUT/DELETE API calls return 403. The `/users` page and "Quick Add" button are hidden in the UI. Attempting to navigate to `/users` redirects to the dashboard.

### Implementation Details
- `role` column on `doctorsTable` (varchar 20, default "admin")
- Session stores `doctorRole` alongside `doctorId`
- Middleware: `restrictWriteForModerator` (global after auth) blocks non-GET requests for moderators
- Middleware: `requireAdmin` (applied to `/users` router) blocks non-admins
- Frontend: `useRole()` / `useIsAdmin()` / `useIsModerator()` hooks in `src/hooks/useRole.ts`
- `AdminRoute` component in App.tsx redirects non-admins away from admin-only pages

## Required Environment Variables

### Production (must be set as secrets/env vars before deploying)
- `SESSION_SECRET` — Required in production. Set as a Replit secret. Strong random string for signing session cookies.
- `CORS_ORIGINS` — Comma-separated list of allowed origins for CORS (e.g. `https://myapp.replit.app`). If unset in production, all browser cross-origin requests will be rejected.
- `DATABASE_URL` — PostgreSQL connection string. Automatically provided by Replit's managed database.
- `PORT` — Port to listen on. Automatically set by Replit's artifact runtime.
- `NODE_ENV` — Set to `production` for production deployments.

### Development
- `SESSION_SECRET` — Optional in dev (a dev-only fallback is used if unset, but setting it is recommended).
- `DATABASE_URL` — Required. Set automatically by Replit's managed database.

### CORS behavior
- **Development** (`NODE_ENV !== "production"`): All origins allowed (CORS is open).
- **Production**: Only origins listed in `CORS_ORIGINS` are allowed. Requests with no `Origin` header (same-origin/server-to-server) are always allowed. If `CORS_ORIGINS` is empty in production, all browser cross-origin requests fail.
