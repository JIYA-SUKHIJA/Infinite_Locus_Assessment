# Student Readiness Control Center — Frontend Data & UI Layer

Multi-tenant React + TypeScript application for the Student Readiness Control Center.

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

## Phase 2 — Student List View

Phase 2 implements the responsive, server-driven Student List View screen on top of the Phase 1 data layer, fully wired to `useStudents` and persisted to URL query parameters via React Router.

### 1. URL Query Parameter Schema
All search, filtering, sorting, and pagination states are synchronized bidirectionally with the URL search parameters through [`src/routes/students/useStudentsQueryParams.ts`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/routes/students/useStudentsQueryParams.ts):

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `q` | `string` | `""` | Search query for student names (debounced by 300ms) |
| `status` | `ReadinessStatus` | `undefined` (`"ALL"`) | Filter by readiness status (`READY`, `NEARLY_READY`, `DEVELOPING`, `NEEDS_PREPARATION`, `INCOMPLETE`) |
| `sortBy` | `string` | `"name"` | Column sorting (`name`, `summaryScore`, `readinessStatus`, `lastActiveAt`) |
| `sortOrder` | `"asc" \| "desc"` | `"asc"` | Sort direction |
| `page` | `number` | `1` | 1-based page number (validated integer >= 1) |
| `pageSize` | `number` | `20` | Number of items per page (1–100) |

- **Deep Link Support**: Reading the URL on mount reconstructs the exact filter and pagination state.
- **Safe Fallbacks**: Invalid or out-of-range parameters in the URL (e.g. `page=-5` or `status=UNKNOWN`) automatically fall back to safe defaults without crashing.
- **Auto-Reset**: Changing `q`, `status`, or `sortBy` automatically resets pagination back to page 1.

### 2. Deterministic Sort Tiebreaker Rule
- When sorting by any column (`name`, `summaryScore`, `readinessStatus`, `lastActiveAt`), ties on identical values are deterministically broken using secondary ordering by student `id`.
- This guarantees stable pagination so rows already viewed do not shift unexpectedly across page boundaries.

### 3. Responsive Breakpoint Decision (Table vs Cards)
- **Breakpoint**: `768px` (`@media (max-width: 768px)`).
- **Desktop & Tablet (> 768px)**: Renders a structured semantic table with keyboard-accessible column header sort buttons and visual direction indicators (`▲`, `▼`, `↕`).
- **Mobile (<= 768px)**: Smoothly degrades to a responsive stacked card layout displaying student details, score badges, cohort, and competency progress without horizontal scroll-trapping.

### 4. Discriminated UI States & Visual Distinction
The screen binds directly to the discriminated union from `useStudents`:
- **`loading` (Initial Load)**: Displays a centered loading spinner and descriptive status text when no data exists yet.
- **`refreshing` (Subsequent Updates)**: **Preserves all currently visible rows in place** while displaying a subtle non-blocking status banner (`"Updating student list..."`) at the top of the table. This prevents full-page layout shifts and flashing loaders during filter/sort changes.
- **`success`**: Displays the student table/cards, server-computed `cohortAverageScore` badge, and page boundary controls.
- **`empty` (Zero Results)**: Displays a friendly "No students found" message with a "Reset All Filters" button, distinct from error states.
- **`error`**: Displays a prominent error alert banner with the server's error message and a "Retry Request" button wired to `refetch()`.

### 5. Untrusted Text Content Protection
- All free-text fields (`name`, `email`, `cohort`) are rendered strictly as React text content (`{student.name}`), preventing any XSS or raw HTML injection vectors.

---

## Directory Structure

```
src/
├── App.tsx                # Router configuration (/students route)
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
├── routes/
│   └── students/
│       ├── index.ts               # Route component exports
│       ├── useStudentsQueryParams.ts # URL search param synchronization
│       ├── SearchInput.tsx        # 300ms debounced search with clear button
│       ├── StatusFilter.tsx       # Accessible readiness status filter chips
│       ├── StatusBadge.tsx        # Server-computed status category badge
│       ├── StudentTable.tsx       # Sortable table with mobile card degradation
│       ├── Pagination.tsx         # Page boundary controls
│       ├── StudentsView.tsx       # Main view coordinating all discriminated states
│       └── StudentsView.module.css # Accessible responsive styling
└── types/
    ├── domain.ts          # Domain entities (StudentSummary, StudentDetail, Attempt, etc.)
    └── state.ts           # Discriminated union state definitions
tests/
├── mocks/
│   └── handlers.ts        # MSW v2 mock handlers
├── setup.ts               # MSW lifecycle and test configuration
├── schemas.test.ts        # Zod runtime validation & fail-closed tests
├── client.test.ts         # fetchApi client, headers & error tests
├── hooks.test.ts          # Hook race-condition & conflict tests
└── routes/
    └── students.test.tsx  # View integration, debounce, deep link & accessibility tests
```

---

## Running Verification

```powershell
# Run all Vitest test suites (34 tests)
npm run test

# Run TypeScript strict typecheck
npm run typecheck
```
