# KetoKid Care

## Overview

A wellness-focused mobile app for parents managing children on ketogenic diets. Parents log in with hospital-provided tokens, view daily nutrition targets, plan meals, track consumption, and review history.

## Architecture

- **Parent App**: React 19 + Vite mobile-first SPA (port 5000)
- **Backend**: Express 5 API server (port 8080)
- **Database**: PostgreSQL with Drizzle ORM
- **Package Manager**: pnpm workspaces monorepo (in `admin website/`)
- **Design System**: "Empathetic Guardian / Digital Sanctuary" — green primary (#006E2F), blue secondary (#0058BE), Inter font, Material Symbols icons, pill shapes, glassmorphism, no border lines

## Project Layout

```
admin website/          # pnpm monorepo
  artifacts/
    api-server/         # Express backend (PORT=8080)
    parent-app/         # React+Vite parent mobile app (PORT=5000)
  lib/
    db/                 # Drizzle ORM schema + DB connection

Mobile App/             # HTML mockups for reference
```

## Development Workflows

- **Start application**: Runs the React parent app on port 5000 (webview)
- **API Server**: Runs the Express API server on port 8080 (console)

## Key Features

- **Token Login**: Parents authenticate with hospital-provided tokens (e.g., "EMMA2024")
- **Dashboard**: Greeting, daily macro progress (carbs/fat/protein/calories), meal task cards
- **Meal Planner**: KPI filter cards, food selection with long-press/tap, save meal plans
- **Consumption Tracking**: Did child eat? Yes/No, portion percent (0/25/50/75/100%)
- **Copy/Edit Meals**: Copy meals between meal types, edit existing plans
- **History**: Date-wise meal history with daily nutrition summaries
- **Profile**: Child info, nutrition targets, parent info, logout

## API Endpoints (Parent)

All under `/api/parent/`:
- `POST /auth/login` — Token-based login
- `POST /auth/logout` — Destroy session
- `GET /dashboard` — Child info, meal types, today's meals, daily progress
- `GET /foods?kpi=carbs|fat|protein|calories` — Foods sorted by KPI
- `POST /meal-plans` — Create meal plan for today
- `PUT /meal-plans/:id` — Update meal plan foods
- `POST /meal-plans/copy` — Copy meal between meal types
- `PUT /meal-plans/:id/eat-status` — Track consumption
- `GET /history?days=N` — Past meal history

## Database Tables (Parent-specific)

- `parent_meal_plans` — Daily meal plans per kid per meal type
- `parent_meal_plan_foods` — Foods in each parent meal plan
- `parent_tokens` — Hospital-generated access tokens

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (auto-provisioned by Replit)
- `SESSION_SECRET`: Session encryption key (required in production)

## Test Data

- Kid: Emma Johnson (KID001), Parent: Sarah Johnson
- Token: `EMMA2024` (active, expires 2027)
- 72 keto-friendly foods seeded (including 10 Beverage items)
- Foods include `serving_size` and `serving_unit` columns (e.g., "100g", "1 cup", "2 tbsp")
- Food categories: Carb, Fat, Protein, Calories, Beverage
- 3 meal types: Breakfast, Lunch, Dinner
