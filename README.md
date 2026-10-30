# seikatsu

Personal life-OS: seven small apps behind one auth shell, one Postgres, one deploy.
Kuroji · Seiryu · Tsundoku · Keizoku · Kyū · Aisha · Hoshii.

[seikatsu.danylomorhun.com](https://seikatsu.danylomorhun.com)

## Layout

```
apps/web          Next.js 16 (App Router, RSC), one feature slice per app
  src/features/<app>/{actions,components,lib}
  src/app/api/cron  daily jobs: recurring, bank sync, notifications
  public/sw.js      service worker: offline shell + push
packages/db       Drizzle schema + SQL migrations (Neon Postgres)
packages/ui       shadcn/Radix primitives, Tailwind 4 tokens
```

## Design notes

- **Server-first.** Pages are server components that read the DB directly; mutations are
  server actions that revalidate. No client cache, no global store; URL params hold UI state.
- **Ownership on every call.** Each action checks session → workspace → every foreign ID it receives.
- **Double-entry ledger.** A transaction is ≥ 2 entries summing to zero in base currency, written atomically;
  rounding goes to the last entry. Historical FX rates are cached per day.
- **Idempotent imports.** PSD2 bank sync and statement parsing share one pipeline keyed by external ID.
- **Offline writes.** Mutations go through an outbox with a replay registry; queued ops are replay-safe.
- **Ordering.** Fractional-index keys: a drag updates one row.
- **Time zones.** The browser zone rides in a cookie, so "today" is computed on the server.

## Pipeline

```
PR   → Biome + tsc → Vitest (PGlite, real migrations) + next build → Playwright on the build
main → migrations (only if changed, manual approval) → Vercel prod (fra1) → smoke → auto-rollback
```

## Run locally

Node 24, pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local
DATABASE_URL=... pnpm --filter @seikatsu/db db:migrate
pnpm dev   # :3010
```

MIT
