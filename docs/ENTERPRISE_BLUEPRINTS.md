# Enterprise Architecture & Engineering Blueprints

> **Note on Authority & Project Context:**
> These blueprints provide reference enterprise hardening patterns, algorithms, and conventions.
> Per project guidelines, `docs/PRD.md`, `docs/TRD.md`, and `docs/SECURITY.md` remain the definitive sources of truth for VitalOrbit (Vite + React 18 + TypeScript + Tailwind frontend; Python 3.11 + FastAPI + SQLite backend; offline-first, no user accounts/passwords/RBAC). Architectural conflicts between these reference blueprints and the project's source of truth documents are cataloged in `README.md`.

---

# Enterprise System Architecture & Folder Structure Blueprint (Next.js / MERN Stack)

## 1. Architectural Principles
- **Modular Monolith to Microservices-Ready:** Strict separation of concerns between presentation, business logic, data access, and infrastructure layers.
- **Strict Domain-Driven Design (DDD):** Features are grouped by business domain rather than technical file types where applicable, preventing spaghetti code in AI-assisted (Vibe-coded) development.
- **Zero-Trust Communication:** Internal service-to-service communication requires signed tokens and validated context.

---

## 2. Directory Structure & File Organization

```
/
├── .env.example
├── .env.production
├── package.json
├── tsconfig.json
├── turbo.json (if monorepo)
├── apps/
│   ├── web/ (Next.js 14+ App Router Frontend)
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router (Server & Client Components)
│   │   │   │   ├── (auth)/          # Route group for authentication pages
│   │   │   │   ├── (dashboard)/     # Route group for protected user/admin views
│   │   │   │   ├── api/             # Next.js Route Handlers (BFF layer)
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/          # Atomic UI elements (shadcn/ui, Radix primitives)
│   │   │   ├── config/              # Public runtime configuration & constants
│   │   │   ├── features/            # Feature-sliced modules (auth, billing, analytics)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── components/  # Feature-specific UI
│   │   │   │   │   ├── hooks/       # Feature-specific TanStack Query hooks
│   │   │   │   │   └── services/    # API callers for auth domain
│   │   │   └── utils/               # Pure formatting utilities & helpers
│   │   └── public/
│   └── api/ (Node.js / Express or NestJS Core Backend)
│       ├── src/
│       │   ├── config/              # Environment schema validation (Zod) & DB connections
│       │   ├── constants/           # Global application constants & enums
│       │   ├── controllers/         # Thin HTTP request/response handlers
│       │   ├── errors/              # Custom operational & system error classes
│       │   ├── middleware/          # Express/Fastify middleware (Auth, Rate Limit, RBAC)
│       │   ├── models/              # Mongoose schemas / Prisma models
│       │   ├── routes/              # API route definitions mapped to controllers
│       │   ├── services/            # Core business logic and transactions
│       │   ├── types/               # TypeScript interfaces and type extensions
│       │   ├── utils/               # Cryptographic helpers, loggers, tokens
│       │   └── server.ts            # Application entry point & graceful shutdown
│       └── package.json
└── packages/
    ├── shared-types/                # Shared TypeScript types & validation schemas (Zod)
    └── config-eslint/               # Shared linting and formatting standards
```

---

## 3. Layered Responsibilities & Data Flow

### Frontend Layer (Next.js App Router)
- **Server Components (RSC):** Default for all pages, fetching data securely on the server using direct database drivers or internal service calls without exposing API keys.
- **Client Components (`"use client"`):** Restricted strictly to interactive components (forms, modals, dynamic charts) utilizing **TanStack Query (React Query)** for async state management.

### Backend Layer (Node.js / Express / NestJS)
- **Controllers:** Receive requests, extract validated parameters, delegate execution to services, and format standardized JSON responses. **Zero business logic allowed here.**
- **Services:** Encapsulate core business transactions, interact with models, trigger background jobs (BullMQ), and emit domain events.
- **Middleware Chain:** Request ID injection -> Helmet Security Headers -> CORS -> Rate Limiting -> Request Body Sanitization -> Zod Validation -> Authentication / RBAC -> Controller.

---

# Enterprise Security Blueprint & Hardening Guide

## 1. Authentication & Session Management
- **Delegated Identity:** Offload credential storage, password hashing (Argon2id/bcrypt), and multi-factor workflows to audited providers (Firebase Auth, WorkOS AuthKit) or use enterprise custom JWT flow.
- **Token Architecture:**
  - **Access Tokens:** Short-lived (15 minutes), signed via RS256 (Asymmetric keys), stored in memory (React state/Zustand) or ephemeral cookies.
  - **Refresh Tokens:** Long-lived (7 days), stored exclusively in **`HttpOnly`**, **`Secure`**, **`SameSite=Strict`** cookies to completely mitigate Cross-Site Scripting (XSS) credential hijacking.
- **Session Revocation:** Maintain a Redis blacklist for revoked access tokens or track token version IDs in user database documents.

---

## 2. API Security & Rate Limiting Strategy
- **Distributed Rate Limiting (Redis + Token Bucket):**
  - **Auth Endpoints (`/api/v1/auth/login`, `/register`, `/forgot-password`):** Strict sliding-window limit of 5 requests per 15 minutes per IP address.
  - **Public APIs:** 60 requests per minute per authenticated user/IP.
  - **Failure Handling:** Return HTTP status `429 Too Many Requests` accompanied by a `Retry-After` header and automated temporary IP shadow-banning for severe brute-force signals.
- **CORS Policy:** Strict domain whitelisting. Absolutely no wildcards (`*`) permitted in production environments.

---

## 3. Data Sanitization & Input Validation
- **Zero Trust Inputs:** Every incoming request body, query parameter, and route header must pass through a strict **Zod** schema validator. Unrecognized keys must be stripped (`strict()` mode).
- **Injection Defenses:**
  - **NoSQL Injection:** Sanitize query payloads; prevent operators like `$ne`, `$gt` from being passed dynamically via URL query strings into Mongoose queries.
  - **SQL Injection:** Enforce parameterization via Prisma/Drizzle ORM query builders.
  - **XSS Mitigation:** Escape all user-generated rendered text and leverage Content Security Policy (CSP) headers.

---

## 4. HTTP Headers & Infrastructure Security
- Enforce hardened security headers using `helmet` or Next.js custom headers:
  - `Content-Security-Policy`: Restricts script execution sources to self and trusted CDNs.
  - `Strict-Transport-Security`: Forces HTTPS for a minimum of 2 years (`max-age=63072000; includeSubDomains; preload`).
  - `X-Frame-Options`: `DENY` to prevent clickjacking.
  - `X-Content-Type-Options`: `nosniff`.

---

# Enterprise Database Architecture, Scaling & Optimization

## 1. Database Engine Selection
- **Primary Datastore:** MongoDB (MERN stack) or PostgreSQL (Next.js ecosystem via Prisma/Drizzle).
- **Caching & Rate Limiting Store:** Redis (Cluster mode configured for high availability).

---

## 2. Schema Design & Normalization Best Practices
- **Indexing Strategy:**
  - Create composite indexes for high-frequency query filters (e.g., `{ tenant_id: 1, status: 1, created_at: -1 }`).
  - Ensure unique sparse indexes on user identifiers (`email`, `username`, `phone_number`).
- **Referential Integrity & Cascades:**
  - Enforce foreign key constraints at the ORM/database level. Implement soft deletes (`deleted_at` timestamps) for mission-critical transactional records instead of permanent hard deletions.
- **Data Partitioning / Sharding:**
  - Design schemas with tenant-id partitioning in mind to allow seamless multi-tenant horizontal scaling as user bases grow.

---

## 3. Query Optimization & Performance Patterns
- **Pagination Strategy:** Never use offset-based pagination (`skip`/`limit`) for large tables as it causes $O(N)$ performance degradation. Always enforce **Cursor-based pagination** using unique identifiers (`cursor: { id: lastSeenId }`).
- **N+1 Query Prevention:** Use database aggregation pipelines, `$lookup` stages, or Prisma/Drizzle `include` statements optimized with selective column projection (`select: { id: true, name: true }`).
- **Transaction Safety:** Wrap multi-document or multi-table mutations inside atomic ACID database transactions (`session.withTransaction()` in MongoDB or `prisma.$transaction()`) to guarantee rollbacks on partial failures.

---

# Core Algorithms & Background Processing Blueprint

## 1. Asynchronous Job Processing & Event Queues
- **Background Worker Architecture:** Use **BullMQ** backed by Redis for offloading CPU-intensive or blocking tasks from the main request-response cycle.
- **Queue Pipeline Categories:**
  - **Notification Queues:** Asynchronous dispatch of transactional emails, push notifications, and SMS alerts with exponential backoff retry policies.
  - **Data Heavy Tasks:** Bulk CSV/PDF exports, image/video transcoding, and analytics aggregation jobs.

---

## 2. Core Algorithmic Workflows

### A. Sliding-Window Rate Limiting Algorithm (Redis Lua Script)
```typescript
// Conceptual implementation pattern for distributed sliding window counter
export async function checkRateLimit(redisClient, identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const clearBefore = now - windowSeconds * 1000;
  const key = `rate_limit:${identifier}`;

  const multi = redisClient.multi();
  multi.zRemRangeByScore(key, 0, clearBefore);
  multi.zAdd(key, [{ score: now, value: `${now}-${Math.random()}` }]);
  multi.zCard(key);
  multi.expire(key, windowSeconds);

  const results = await multi.exec();
  const requestCount = results[2] as number;

  if (requestCount > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - requestCount };
}
```

### B. Cursor-Based Pagination Algorithmic Pattern
```typescript
// High-efficiency cursor pagination query builder
export async function getPaginatedRecords(model: any, limit: number, cursor?: string, filterQuery = {}) {
  const queryOptions: any = {
    take: limit + 1, // Fetch one extra to check if there is a next page
    where: filterQuery,
    orderBy: { createdAt: 'desc' },
  };

  if (cursor) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1; // Skip the cursor itself
  }

  const records = await model.findMany(queryOptions);
  let nextCursor: string | null = null;

  if (records.length > limit) {
    const nextItem = records.pop(); // Remove the extra record
    nextCursor = nextItem.id;
  }

  return {
    data: records,
    nextCursor,
  };
}
```