# seikatsu

personal web app for finances, tasks, books, habits, job search, car care and a wishlist.
it works on phone and desktop, installs as a PWA and keeps working offline.
an MCP server exposes the same data to AI assistants.

live at [seikatsu.danylomorhun.com](https://seikatsu.danylomorhun.com).

## apps

seven small apps share one login, one database and one deploy.

| app      | what it does                                                    |
| :------- | :-------------------------------------------------------------- |
| kuroji   | double-entry bookkeeping with multiple currencies and bank sync |
| seiryu   | kanban board with projects, checklists and labels               |
| tsundoku | book library, reading sessions, shelves and quotes              |
| keizoku  | daily habits and streaks                                        |
| kyuu     | job applications and their stages                               |
| aisha    | car mileage, maintenance schedule and service history           |
| hoshii   | wishlist with a waiting period before buying                    |

## stack

Next.js 16 with App Router and server components, Drizzle, Neon Postgres, Auth.js,
Tailwind 4, shadcn/ui. hosted on Vercel.

## structure

```
apps/web       Next.js app, one folder per app in src/features
packages/db    Drizzle schema and SQL migrations
packages/ui    shared UI components and Tailwind tokens
```

## how it works

pages are server components that read the database directly, and changes go through
server actions. there is no client cache or global store. UI state lives in the URL.
every action checks that the session owns the workspace and every ID it receives.

each kuroji transaction has at least two entries that sum to zero in the base currency
and is written in one database transaction. exchange rates are cached per day.
bank sync (PSD2) and statement imports use the same pipeline and skip records
that were already imported.

changes made offline are queued and sent again when the connection is back.
each queued change is safe to send twice.

drag and drop updates one row, using fractional index keys. the browser time zone
is stored in a cookie, so the server knows what "today" is.

## CI

| when         | what runs                                                                     |
| :----------- | :---------------------------------------------------------------------------- |
| pull request | Biome, type check, Vitest on PGlite with real migrations, build, Playwright   |
| every night  | deploy of new commits on main: migrations, Vercel build, smoke test, rollback |
| every night  | encrypted database backup, restored into a temporary Postgres as a check      |

migrations run only when they changed and need manual approval.
an urgent fix can be deployed by hand from the Actions tab.

## run locally

requires Node 24 and pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local
DATABASE_URL=... pnpm --filter @seikatsu/db db:migrate
pnpm dev
```

the app runs on port 3010. `.env.example` lists every variable and where to get it.

## license

MIT
