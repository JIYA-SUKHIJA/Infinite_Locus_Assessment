# Student Readiness Control Center — Frontend Data Layer

Multi-tenant React + TypeScript data access and typed boundary layer for the Student Readiness Control Center.

---

## Phase 1 — API Layer

This phase establishes a runtime-validated, backend-agnostic API client and query-hook layer. No unvalidated external JSON is ever treated as trusted application data.

### 1. Fail-Closed Validation Strategy
- All network responses are parsed at runtime using strict [Zod](file:///d:/Infinite%20locus_Assessment/Part%20B/src/api/schemas.ts) schemas (`.strict()`).
- Unrecognized properties, malformed shapes, or type mismatches immediately throw an `ApiValidationError` rather than silently passing through or casting as `any`.
- Standard backend error envelopes (`{ code, message, requestId, fieldErrors }`) are parsed into strongly-typed `ApiError` instances.
- **List vs Detail separation**: `StudentSummary` (used in paginated list views) and `StudentDetail` (used in detail views with nested competency attempts and required `version`) are strictly decoupled.

### 2. Tenant & Auth Isolation (Security)
- Multi-tenancy headers (`x-tenant-id`) and bearer tokens (`Authorization: Bearer ...`) are managed exclusively through [`src/api/config.ts`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/api/config.ts) and injected by [`fetchApi`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/api/client.ts).
- Tenant IDs are **never** passed via query parameters or body payloads to prevent tenant spoofing.

### 3. Concurrency & Conflict Handling
- **Optimistic Concurrency Control**: Any updatable entity requires an integer `version`. `usePatchStudent` transmits `expectedVersion` via the standard HTTP `If-Match: "<version>"` header.
- **HTTP 409 Conflict Discrimination**: When an update conflicts with the current server state, `usePatchStudent` surfaces a `{ status: 'conflict', message, error, data: null }` discriminated state rather than a generic error.
- **Idempotency**: `useSubmitAttempt` generates a unique UUID `Idempotency-Key` header with each submission to prevent duplicate attempt creations upon retries.

### 4. Out-of-Order Response Protection & React StrictMode
- **Sequence Tokens & Cancellation**: Query hooks (`useStudents`, `useStudentDetail`, `useStudentActivity`) maintain an incrementing sequence token (`useRef<number>`) and an active `AbortController`.
- **Supersession**: When parameters change before an in-flight request resolves, the previous network request is aborted and any late-resolving promises are discarded.
- **Double-Mount Resilience**: Works reliably in React 18 Strict Mode and concurrent rendering without flashing stale data or triggering spurious error states.

### 5. Discriminated Union State Modeling
All hook results follow strict discriminated union types:
- **`QueryState<T>`**: `idle` | `loading` | `refreshing` | `success` | `error`
- **`MutationState<T>`**: `idle` | `loading` | `success` | `conflict` | `error`

This eliminates impossible states (e.g. `isLoading === true && error !== null`).

---

## Directory Structure

```
src/
├── api/
│   ├── client.ts          # Typed fetchApi client & ApiError / ApiValidationError
│   ├── config.ts          # Tenant ID & base URL configuration
│   ├── schemas.ts         # Fail-closed Zod schemas for all endpoints
│   └── hooks/
│       ├── index.ts               # Hook exports
│       ├── useStudents.ts         # Paginated student list with race protection
│       ├── useStudentDetail.ts    # Student detail by ID with version
│       ├── useSubmitAttempt.ts    # Attempt submission with Idempotency-Key
│       ├── usePatchStudent.ts     # Patch hook with 409 conflict handling
│       └── useStudentActivity.ts  # Mongo audit log activity stream
└── types/
    ├── domain.ts          # Domain entities (StudentSummary, StudentDetail, Attempt, etc.)
    └── state.ts           # Discriminated union state definitions
tests/
├── mocks/
│   └── handlers.ts        # MSW v2 mock handlers
├── setup.ts               # MSW lifecycle and test configuration
├── schemas.test.ts        # Zod runtime validation & fail-closed tests
├── client.test.ts         # fetchApi client, headers & error tests
└── hooks.test.ts          # Hook race-condition & conflict tests
```

---

## Running Verification

```powershell
# Run the test suite
npm run test

# Run TypeScript strict typecheck
npm run typecheck
```
