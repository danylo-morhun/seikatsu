# seikatsu — Modular Personal Ecosystem Super-App

[![CI Pipeline](https://github.com/danylo-morhun/seikatsu/actions/workflows/ci.yml/badge.svg)](https://github.com/danylo-morhun/seikatsu/actions/workflows/ci.yml)
[![Next.js 15](https://img.shields.io/badge/Next.js-15_App_Router-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.3-EF4444?logo=turborepo)](https://turbo.build/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-PostgreSQL-C5F74F?logo=postgresql)](https://orm.drizzle.team/)
[![Biome](https://img.shields.io/badge/Biome-Code_Quality-60A5FA?logo=biome)](https://biomejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)

A high-performance personal "super-app" ecosystem unifying multi-domain daily utilities under a single authenticated shell. Built as a production-grade monorepo using **Next.js 15 App Router**, **React 19**, **Neon Serverless PostgreSQL**, **Drizzle ORM**, and **NextAuth v5**.

**Live Application**: [https://seikatsu.danylomorhun.com](https://seikatsu.danylomorhun.com)

---

## System Architecture

```mermaid
graph TD
    subgraph Client ["Client Layer (Browser)"]
        UI["shadcn/ui + Tailwind CSS 4"]
        Hooks["React Hook Form + Zod v4"]
    end

    subgraph App ["Next.js 15 App Router (@seikatsu/web)"]
        AuthMiddleware["NextAuth v5 Session Guard"]
        
        subgraph Slices ["Feature Slices"]
            Kuroji["Kuroji: Double-Entry Finance"]
            Seiryu["Seiryu: Fractional Indexing Kanban"]
            Tsundoku["Tsundoku: Open Library Tracker"]
        end
    end

    subgraph Packages ["Monorepo Workspaces"]
        P_UI["@seikatsu/ui (Shared Design Tokens & Components)"]
        P_DB["@seikatsu/db (Drizzle Schemas & Migrations)"]
    end

    subgraph Infrastructure ["Cloud Infrastructure"]
        DB[(Neon Serverless PostgreSQL)]
        Blob[Vercel Blob Storage]
        Auth[GitHub OAuth / JWT Strategy]
    end

    Client --> UI
    UI --> AuthMiddleware
    AuthMiddleware --> Kuroji & Seiryu & Tsundoku
    Kuroji & Seiryu & Tsundoku --> P_UI
    Kuroji & Seiryu & Tsundoku --> P_DB
    P_DB --> DB
    AuthMiddleware --> Auth
```

---

## Application Modules

| Module | Route | Status | Key Technical Implementation |
| :--- | :--- | :--- | :--- |
| **Kuroji** | `/kuroji` | Production v1 | **Double-Entry Ledger Engine**: Multi-currency accounting with strict credit/debit balances, automated NBU exchange rate fetching, and Privat24 statement parsers. |
| **Seiryu** | `/seiryu` | Production v1 | **Fractional Indexing Kanban**: $O(1)$ drag-and-drop card reordering algorithm powered by `fractional-indexing` to eliminate $O(N)$ DB order updates. |
| **Tsundoku** | `/tsundoku` | Production v1 | **Personal Library Manager**: Integration with Open Library API, reading progress analytics, quote archives, and custom shelf management. |
| **Kyū** | `/kyuu` | Production v1 | **Job Application Tracker**: Pipeline management for job applications, interview stages, resume file attachments, and recruitment analytics. |
| **Keizoku** | `/keizoku` | Production v1 | **Habit Tracker**: Daily habit tracking engine with streak calculations, completion heatmaps, and target goals. |

---

## Technical Decisions & Engineering Trade-Offs

| Engineering Choice | Alternative Considered | Rationale & Architectural Trade-off |
| :--- | :--- | :--- |
| **Turborepo + pnpm** | Lerna / Nx | Selected Turborepo for lightweight configuration, native pnpm workspace support, and sub-second CI build caching across `@seikatsu/db`, `@seikatsu/ui`, and `@seikatsu/web`. |
| **Drizzle ORM** | Prisma ORM | Chosen Drizzle for zero-runtime query execution, raw SQL performance, explicit migrations, and zero memory overhead on serverless edge handlers. |
| **Biome** | ESLint + Prettier | Switched to Biome for a unified Rust-based toolchain, executing linting and formatting checks across 300+ files in under **50ms**. |
| **Fractional Indexing** | Integer Position Columns | Re-indexing $N$ items on every drag-and-drop requires updating $N$ rows in PostgreSQL. Fractional indexing computes an alphanumeric string between adjacent items, enabling single-row $O(1)$ mutations. |
| **Zod v4 Schema Validation** | Yup / Joi | Strict compile-time type inference for server action payloads and API response parsing. |

---

## Automated Quality & CI/CD Matrix

Every commit and pull request passes through a multi-stage GitHub Actions matrix pipeline:

1. **Security & Audit**: `pnpm audit --audit-level=high` scans workspace dependencies for vulnerabilities.
2. **Code Quality (Biome)**: Validates code formatting, import order, and linting rules.
3. **Static Type Analysis**: `pnpm typecheck` enforces zero type errors across all monorepo workspaces.
4. **Unit & Integration Suite**: `pnpm test` executes Vitest test suites covering ledger accounting transactions, Privat24 parsers, and reordering algorithms.
5. **Production Build Verification**: `pnpm build` verifies Next.js App Router static optimization and compilation.

---

## Local Development Setup

### Prerequisites
- Node.js `22.x`
- `pnpm` `^10.0`
- PostgreSQL database (or Neon serverless instance)

### 1. Clone & Install
```bash
git clone git@github.com:danylo-morhun/seikatsu.git
cd seikatsu
pnpm install
```

### 2. Environment Configuration
Create `.env` in `apps/web`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/seikatsu"
AUTH_SECRET="your-32-character-auth-secret"
AUTH_URL="http://localhost:3010"
```

### 3. Database Migration & Development Server
```bash
# Push database schemas
pnpm --filter @seikatsu/db db:push

# Start all workspaces concurrently
pnpm dev
```
Open [http://localhost:3010](http://localhost:3010) in your browser.

---

## License

MIT © Danylo Morhun
