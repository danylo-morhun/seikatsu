# seikatsu

[![CI](https://github.com/danylo-morhun/seikatsu/actions/workflows/ci.yml/badge.svg)](https://github.com/danylo-morhun/seikatsu/actions/workflows/ci.yml)

One app for daily life: money, tasks, books, habits, job search, car, wishlist.

[seikatsu.danylomorhun.com](https://seikatsu.danylomorhun.com)

## Apps

- **Kuroji** — finance: double-entry ledger, multi-currency, recurring transactions, bank sync, Apple Pay capture, charts
- **Seiryu** — kanban: projects, cards, checklists, labels, due dates
- **Tsundoku** — books: search, shelves, quotes, reading sessions, year review
- **Keizoku** — habits: week view, streaks, photo log, year page
- **Kyū** — job search: what to do next, stats, Gmail sync where Gemini turns replies into events
- **Aisha** — car care: service log, reminders by mileage and date, documents
- **Hoshii** — wishlist: wants cool off by price, then one ranked plan funded from a Kuroji savings account

Installable as a PWA: works offline, push reminders, share links straight into Hoshii.

## How it works

- **Ledger** — every transaction is a set of entries that sum to zero, written in one DB transaction; rounding drift goes to the last entry
- **Bank import** — Enable Banking (PSD2) sync and a Privat24 .xlsx parser share one core; a unique external ID makes re-imports safe
- **Exchange rates** — cached per day in Postgres; UAH pairs from PrivatBank, the rest from ECB via Frankfurter
- **Ordering** — fractional indexing, so drag-and-drop updates one row
- **Time zones** — the browser's zone goes into a cookie, so "today" renders on the server
- **Tests** — business logic lives in pure functions; DB tests run real migrations on in-memory Postgres (PGlite); Playwright for E2E
- **Deploy** — GitHub Actions runs migrations only when they changed (with approval), deploys, smoke-tests, and rolls back on failure

## Stack

Next.js 16, React 19, Turborepo, Drizzle, Neon Postgres, NextAuth v5, Tailwind 4, Vercel.

## Run locally

Needs Node 24 and pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local   # DATABASE_URL, AUTH_SECRET, and keys for one sign-in method
DATABASE_URL=... pnpm --filter @seikatsu/db db:push
pnpm dev                              # http://localhost:3010
```

## License

MIT
