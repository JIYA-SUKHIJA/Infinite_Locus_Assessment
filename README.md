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

## Phase 4 — Attempt Submission & Student Edit Forms

Phase 4 turns the detail view entry points into real, production-ready form modals wired to `useSubmitAttempt` and `usePatchStudent` mutations with optimistic concurrency and idempotency guarantees.

### 1. Attempt Submission Form & Idempotency Key Lifecycle
- **Modal Component**: [`AttemptSubmissionForm.tsx`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/routes/students/%5Bid%5D/AttemptSubmissionForm.tsx).
- **Idempotency Lifecycle**:
  - A fresh UUID `Idempotency-Key` is generated on every new modal open session via `crypto.randomUUID()` (or fallback generator).
  - **Key Retention on Retry**: If a network failure occurs (HTTP status 0 / `NETWORK_ERROR`), the same `Idempotency-Key` is retained for subsequent retry attempts of that exact submission.
  - **Key Regeneration on Reopen**: Closing the dialog and opening it for a new attempt session generates a brand new UUID key, preventing unintended server-side replay.
- **Double-Submit Prevention**: Uses an `isSubmittingRef` lock and disabled button states during the pending `loading` cycle, ensuring rapid double-clicks trigger only a single network request (`mswCallCount === 1`).
- **Honest Network Failure Messaging**: When network errors occur where the client cannot determine if the server received the payload, the UI displays an explicit reassurance alert explaining that retrying is safe due to idempotency key protection.

### 2. Student Edit Form & Optimistic Concurrency (HTTP 409 Conflict)
- **Modal Component**: [`StudentEditForm.tsx`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/routes/students/%5Bid%5D/StudentEditForm.tsx).
- **Allowlisted Fields**: Only mutable fields (`name`, `email`, `cohort`) are editable. System-owned properties (`id`, `readinessStatus`, `summaryScore`, `competencies`, `version`, `createdAt`, `updatedAt`) are immutable.
- **`If-Match` Concurrency**: Transmits `student.version` as `expectedVersion` via the HTTP `If-Match: "<version>"` header.
- **Distinct Conflict UI (HTTP 409)**:
  - When the server detects that another session modified the record, `usePatchStudent` emits `status: 'conflict'`.
  - The UI renders a structurally distinct `.conflictAlert` banner with heading `"Record Conflict Detected (HTTP 409)"` and two explicit resolution paths:
    1. **"Reload Latest & Reapply"**: Triggers `onRefreshLatest()` to fetch the updated student entity and version without losing local intent.
    2. **"Discard Changes"**: Closes the dialog and resets the state.
  - This is structurally distinguished from generic 500 errors (which render `.errorAlert` with standard retry text and no conflict resolution actions).

### 3. Accessible Dialogs & Focus Management
- Accessible modal dialogs with `role="dialog"`, `aria-modal="true"`, and labeled headers.
- Input validation with real-time feedback, `aria-invalid="true"`, and `aria-describedby` error associations.
- Keyboard support: `Escape` key dismisses modals when not actively loading, and initial input focus is automated on open.

---

## Phase 5 — Activity Log & Seeded Cross-Tenant Defect Resolution

Phase 5 addresses two essential requirements: implementing the Student Activity Audit Log view (`ActivityLog.tsx`) and diagnosing and eliminating the seeded cross-tenant data leak defect across all trust boundaries.

### 1. Seeded Defect: Root Cause Analysis (Part D Live Defense Guide)

#### The Problem
In multi-tenant SaaS systems, users or administrators may rapidly switch active tenant accounts. Under fast account switching, confidential student records belonging to Tenant A were intermittently displayed on the screen while logged into Tenant B.

#### Root Causes Identified
1. **Unsubscribed API Config Changes**:
   - `config.ts` stored tenant identity in a module-level mutable singleton (`getApiConfig().tenantId`), with no notification/subscription mechanism. When `setApiConfig({ tenantId: 'tenant-B' })` was invoked, React hooks (`useStudents`, `useStudentDetail`, `useStudentActivity`) were not notified and did not trigger a re-fetch.
2. **Asynchronous In-Flight Race Conditions**:
   - When a slow request was initiated under Tenant A, switching to Tenant B left Request A in flight. When Request A resolved 200ms later, the hook checked sequence tokens (`currentSeq === sequenceRef.current`) which were only incremented within individual hooks and were completely unaware of `tenantId`. Request A's promise resolution wrote Tenant A's private payload into state while under Tenant B's active session.
3. **Stale State Retention Across Tenant Boundary (`prev.data` Preservation)**:
   - In Phases 2 & 3, the `refreshing` state preserved `prev.data` to prevent layout shifts during query/filter changes. When transitioning across tenant boundaries, preserving `prev.data` kept Tenant A's records visible on screen while Tenant B was loading or if Tenant B's query failed.

#### The Fix at the Trust Boundary
- **Subscriber Event Registry in [`src/api/config.ts`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/api/config.ts)**:
  - Added `subscribeApiConfig(listener)` so all data hooks and UI components are immediately notified when `tenantId` changes.
  - Subscriptions clean up automatically on component unmount (`useEffect` return cleanup), completely preventing memory leaks.
- **Header Tenant Visibility Pill ([`Navbar.tsx`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/components/Navbar.tsx))**:
  - Subscribes to `subscribeApiConfig` to display the active tenant ID in real-time in the header navigation (`Tenant: tenant-alpha` or `default`).
  - Provides instant visual verification during live defense demonstrations that data isolation matches the active tenant context.
- **Request-Instance & Tenant Tagging in Hooks**:
  - Each request captures both a monotonic sequence token (`currentSeq = ++sequenceRef.current`) and the current tenant ID (`currentTenantId = getApiConfig().tenantId`).
  - Response resolution verifies both:
    ```typescript
    if (currentSeq !== sequenceRef.current || currentTenantId !== getApiConfig().tenantId) {
      return; // Instantly discard stale / cross-tenant responses
    }
    ```
- **UX vs. Security Decision — Immediate State Clearing**:
  > **Explicit Rule: Security > Smooth UX**
  > While parameter updates (e.g. search/pagination) preserve `prev.data` to avoid UI flashing, **tenant transitions MUST NEVER preserve `prev.data`**. Upon receiving a tenant change notification, the hook immediately sets `state = { status: 'loading', data: null, error: null }` and aborts all in-flight requests from the previous tenant.

#### Test Verification Proof
- `tests/routes/tenantSwitchLeak.test.tsx` explicitly reproduces the bug:
  - Dispatches slow in-flight request for Tenant A (200ms) with confidential data, triggers fast account switch to Tenant B (30ms).
  - Confirms red-to-green transition: before the fix, Tenant A's confidential student rendered under Tenant B; after the fix, Tenant A data is guaranteed `null` and Tenant B's public record renders cleanly.
  - Tests rapid flip-flop (Tenant A -> Tenant B -> Tenant A) proving that an older in-flight request from Tenant A cannot win the race due to per-request sequence tagging.

---

### 2. Student Activity Audit Log View

- **Component**: [`ActivityLog.tsx`](file:///d:/Infinite%20locus_Assessment/Part%20B/src/routes/students/%5Bid%5D/ActivityLog.tsx).
- **Discriminated State Machine**: Seamlessly handles `loading`, `refreshing`, `success`, `empty` (friendly "No audit activity recorded" placeholder), and `error` (with retry button).
- **Bounded Pagination**:
  - Fixed page size (`pageSize = 10`), bounded page controls (`1` to `totalPages`), with previous/next controls disabled at boundaries (`!hasPrevPage`, `!hasNextPage`).
- **Safe Event Rendering (No Untrusted JSON Dumps)**:
  - Formats Mongo-sourced audit event payloads using safe, type-guarded property extractors:
    - `ATTEMPT_SUBMITTED`: Formatted score, max score, passed badge, competency code, and logging actor.
    - `READINESS_UPDATED`: Displays previous status and formatted readiness badge.
    - `PROFILE_UPDATED`: Displays human-readable list of modified attributes.
    - `STATUS_OVERRIDDEN`: Displays override justification reason and authorizing instructor.
  - Raw JSON strings and unvalidated external structures are never rendered into the DOM.

---

## Local Development with Mocks

MSW Service Worker browser mocking is available for interactive local frontend development without requiring a live backend server:

1. **Enable Mocking in `.env.development.local`**:
   ```env
   VITE_USE_MOCKS=true
   ```
2. **Start Vite Dev Server**:
   ```powershell
   npm run dev
   ```
3. Open `http://localhost:5173/students` in your browser. MSW intercepts all `/api/*` endpoints asynchronously in development mode before React mounts.

---

## Directory Structure

```
src/
├── App.tsx                        # Router configuration & Navbar integration
├── main.tsx                       # Async gated MSW browser worker bootstrap
├── styles/
│   └── tokens.css                 # Light-mode enterprise design tokens
├── components/
│   ├── Navbar.tsx                 # Brand navigation header with tenant visibility pill
│   ├── Navbar.module.css          # Navbar responsive styles
│   ├── EmptyState.tsx             # Reusable zero-state presentation component
│   └── EmptyState.module.css      # Empty state layout and SVG icon styles
├── mocks/
│   ├── handlers.ts                # Shared MSW v2 mock handlers (single source of truth)
│   └── browser.ts                 # Dev browser ServiceWorker setup
├── api/
│   ├── client.ts                  # Typed fetchApi client & ApiError / ApiValidationError
│   ├── config.ts                  # Tenant context store with subscription event registry
│   ├── schemas.ts                 # Fail-closed Zod schemas for all endpoints
│   └── hooks/
│       ├── index.ts               # Hook exports
│       ├── usePatchStudent.ts     # Patch hook with 409 conflict handling
│       ├── useStudentActivity.ts  # Tenant-safe activity audit log hook
│       ├── useStudentDetail.ts    # Tenant-safe student detail hook
│       ├── useStudents.ts         # Tenant-safe paginated student list hook
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
│       └── [id]/                  # Detail view sub-route
│           ├── index.ts           # Detail component exports
│           ├── CompetencyList.tsx # Dynamic competency evidence + attempt trigger
│           ├── ActivityLog.tsx    # Safe student activity timeline & audit log
│           ├── StudentDetailView.tsx # Detail container + non-disclosure not-found
│           ├── StudentDetailView.module.css # Detail view & modal responsive styles
│           ├── AttemptSubmissionForm.tsx # Attempt submission modal with idempotency
│           └── StudentEditForm.tsx # Student edit modal with 409 conflict UI
└── types/
    ├── domain.ts                  # Domain entities (StudentSummary, StudentDetail, etc.)
    └── state.ts                   # Discriminated union state definitions
tests/
├── mocks/
│   └── handlers.ts                # Re-exports shared handlers from src/mocks/handlers.ts
├── setup.ts                       # MSW lifecycle and test configuration (Node server)
├── schemas.test.ts                # Zod runtime validation & fail-closed tests
├── client.test.ts                 # fetchApi client, headers & error tests
├── hooks.test.ts                  # Hook race-condition & conflict tests
└── routes/
    ├── students.test.tsx          # List view integration, debounced race & empty state tests
    ├── studentDetail.test.tsx     # Detail view integration & non-disclosure tests
    ├── forms.test.tsx             # Attempt & edit form integration + conflict tests
    ├── tenantSwitchLeak.test.tsx  # Cross-tenant data leak reproduction & isolation tests
    └── activity.test.tsx          # Activity log safe rendering & bounded pagination tests
```

---

## Running Verification

```powershell
# Run all Vitest test suites (60 tests)
npm run test

# Run TypeScript strict typecheck
npm run typecheck
```
