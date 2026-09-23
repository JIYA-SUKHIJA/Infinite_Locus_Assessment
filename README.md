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

## Phase 3 — Student Detail View

Phase 3 implements the Student Detail View at `/students/:id`, displaying overall readiness, score aggregates, dynamic server-derived competency evidence lists, non-disclosure security states, and Phase 4 action entry point stubs.

### 1. State Handling Summary & Discriminated UI States
The detail screen connects directly to [`useStudentDetail(id)`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/api/hooks/useStudentDetail.ts):
- **`loading`**: Centered skeleton spinner and descriptive status text during initial fetch.
- **`refreshing`**: **Preserves all visible student details in place** while displaying a subtle top banner (`"Updating student details..."`).
- **`success`**: Full profile rendering with profile summary card, server-computed `summaryScore`, `StatusBadge`, and dynamic `CompetencyList`.
- **`partial-data / INCOMPLETE`**: If any competency has no attempts recorded (`latestAttempt === null`), it is treated as a **valid business success state**, rendering an explicit `"No attempt evidence recorded yet."` placeholder rather than triggering an error state.
- **`error`**: Handled via two distinct branches:
  1. *Non-Disclosure Security (404/403)*: Generic `"Student Not Found"` state.
  2. *Server/Network Errors (5xx/Network)*: Actionable error banner with `"Retry Request"`.

### 2. Security Non-Disclosure Decision (403 Forbidden vs 404 Not Found)
To prevent cross-tenant enumeration attacks (discovering whether a student ID exists in another tenant):
- Responses returning HTTP 404 (`STUDENT_NOT_FOUND`) and HTTP 403 (`FORBIDDEN_RESOURCE` / cross-tenant access denied) render **byte-for-byte identical copy and UI components**:
  > *"Student Not Found — The requested student record does not exist or you do not have permission to view it."*
- Cross-tenant requests never reveal the existence of students outside the active tenant.

### 3. Back-Navigation Approach & Safe Fallback Decision
- **Query State Preservation**: When navigating from the student list to a detail page, `StudentTable` passes active list parameters in React Router location state (`state={{ from: location.search }}`).
- **Navigation Target**:
  ```typescript
  const backTarget =
    location.state && typeof location.state === 'object' && 'from' in location.state
      ? `/students${(location.state as { from?: string }).from ?? ''}`
      : '/students';
  ```
- **Fallback Rule**: If `location.state` is absent (such as direct deep links, browser refresh, or shared URLs), the back button navigates safely to `/students` (the root list view with default parameters). `navigate(-1)` is explicitly avoided to prevent navigating the user outside the application.

### 4. Version Threading for Phase 4
- `StudentDetail.version` is required on the entity model for optimistic locking.
- In `StudentDetailView`, `student.version` is exposed directly on the header card (`data-version={data.data.version}`) and passed as an argument to the `onEditStudent(id, version)` stub handler. Phase 4 edit modals will consume this version directly to construct `If-Match: "<version>"` headers without making redundant API calls.

### 5. Evaluator Field Decision & Known Schema Gap
- In accordance with Phase 1's strict fail-closed contract, `Attempt` only contains typed primitive fields (`score`, `maxScore`, `passed`, `timestamp`) and untyped `metadata?: Record<string, unknown>`.
- The frontend **drops evaluator display** rather than guessing or parsing untyped JSON from `metadata`. This is documented as a known backend schema gap to be addressed if evaluator tracking is formalized into the backend contract in a future iteration.

---

## Directory Structure

```
src/
├── App.tsx                        # Router configuration (/students and /students/:id)
├── api/
│   ├── client.ts                  # Typed fetchApi client & ApiError / ApiValidationError
│   ├── config.ts                  # Tenant ID & base URL configuration
│   ├── schemas.ts                 # Fail-closed Zod schemas for all endpoints
│   └── hooks/
│       ├── index.ts               # Hook exports
│       ├── usePatchStudent.ts     # Patch hook with 409 conflict handling
│       ├── useStudentActivity.ts  # Mongo audit log activity stream
│       ├── useStudentDetail.ts    # Student detail by ID with version
│       ├── useStudents.ts         # Paginated student list with race protection
│       └── useSubmitAttempt.ts    # Attempt submission with Idempotency-Key
├── routes/
│   └── students/
│       ├── index.ts               # Route component exports
│       ├── useStudentsQueryParams.ts # URL search param synchronization
│       ├── SearchInput.tsx        # 300ms debounced search with clear button
│       ├── StatusFilter.tsx       # Accessible readiness status filter chips
│       ├── StatusBadge.tsx        # Server-computed status category badge
│       ├── StudentTable.tsx       # Sortable table with detail links and mobile cards
│       ├── Pagination.tsx         # Page boundary controls
│       ├── StudentsView.tsx       # List view coordinating all discriminated states
│       ├── StudentsView.module.css # List view accessible styling
│       └── [id]/                  # [NEW] Detail view sub-route
│           ├── index.ts           # Detail component exports
│           ├── CompetencyList.tsx # Dynamic competency evidence + Phase 4 stubs
│           ├── StudentDetailView.tsx # Detail container + non-disclosure not-found
│           └── StudentDetailView.module.css # Detail view responsive styles
└── types/
    ├── domain.ts                  # Domain entities (StudentSummary, StudentDetail, etc.)
    └── state.ts                   # Discriminated union state definitions
tests/
├── mocks/
│   └── handlers.ts                # MSW v2 mock handlers
├── setup.ts                       # MSW lifecycle and test configuration
├── schemas.test.ts                # Zod runtime validation & fail-closed tests
├── client.test.ts                 # fetchApi client, headers & error tests
├── hooks.test.ts                  # Hook race-condition & conflict tests
└── routes/
    ├── students.test.tsx          # List view integration & debounced race tests
    └── studentDetail.test.tsx     # Detail view integration & non-disclosure tests
```

---

## Running Verification

```powershell
# Run all Vitest test suites (42 tests)
npm run test

# Run TypeScript strict typecheck
npm run typecheck
```
