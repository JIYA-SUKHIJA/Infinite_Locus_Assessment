# Architecture & Engineering Decisions

This document records the rationale, architectural trade-offs, and boundary decisions made across the Student Readiness Control Center codebase.

---

## 1. Authentication & Session Scope (Seeded Persona Picker vs. Full Credential Auth)

* **Decision**: Implement a client-side seeded persona picker (`/login`) backed by an in-memory `ApiConfig` subscription store (`src/api/config.ts`) and MSW v2 bearer token validation (`requireAuth`), rather than a full username/password credential flow with JWT signing or OAuth2/OIDC.
* **Justification**:
  1. **Frontend-Only Scope**: The current system runs entirely client-side against MSW service worker mocks without a live authentication server or user database.
  2. **Preventing Misleading UI**: Adding password inputs that accept arbitrary dummy strings creates a deceptive UI that mimics security without actual cryptographic verification.
  3. **Multi-Tenant Demo & Defense Visibility**: A seeded persona picker allows instructors and evaluators to instantly switch between distinct tenant roles (`tenant-blue` Admin, `tenant-green` Evaluator, `tenant-amber` Viewer) to demonstrate tenant isolation and role-based behavior live.
* **Production Path**:
  In a production backend integration, this flow plugs into an OAuth2 / OIDC authorization code flow with PKCE or SAML 2.0 SSO, storing tokens in secure, `httpOnly`, `SameSite=Strict` session cookies rather than client memory, with automated token refresh cycles.

---

## 2. Reactivity via `useSyncExternalStore` vs. Global State Libraries

* **Decision**: Manage API and session configuration through a module-level store in `src/api/config.ts` paired with React 18's native `useSyncExternalStore` hook (`useAuth.ts`), avoiding external state management libraries (Redux, Zustand, Recoil).
* **Justification**:
  1. **Non-React Utility Accessibility**: Network clients (`fetchApi`) and utility modules need synchronous, non-hook access to active `tenantId` and `authToken` headers without requiring React Context providers.
  2. **Zero Tearing & Stale Closures**: `useSyncExternalStore` guarantees instantaneous, tear-free re-renders across route guards (`ProtectedRoute`) and navigational headers (`Navbar`) upon login, sign-out, or tenant switching.
  3. **Zero Runtime Overhead**: Avoids unnecessary bundle weight and boilerplate for state that is fundamentally an API client configuration.

---

## 3. Immediate State Invalidation on Tenant Switch (Security > Polish)

* **Decision**: Clear application state immediately (`data: null`) upon tenant identity change, intentionally bypassing the non-blank `refreshing` pattern used for ordinary query/filter updates.
* **Justification**:
  1. **Cross-Tenant Data Leak Prevention**: Under fast account switching, preserving `prev.data` from Tenant A while Tenant B is loading exposes confidential student records across organization boundaries.
  2. **Security Precedence**: Data privacy and tenant boundary guarantees strictly supersede aesthetic UI transition smoothness.

---

## 4. Header-Only Multi-Tenant Scoping (`x-tenant-id`)

* **Decision**: Transmit tenant context strictly via HTTP request headers (`x-tenant-id` and `Authorization: Bearer <token>`) rather than mutable URL route segments or request body payloads.
* **Justification**:
  1. **Spoofing & Tampering Prevention**: Prevents malicious clients or unprivileged users from manipulating query parameters to cross-fetch records belonging to unassigned tenants.
  2. **Server-Side Enforcement**: Ensures authorization decisions remain enforced at the API gateway / backend layer independent of client-side view state.

---

## 5. Fail-Closed Runtime Schema Validation (Zod)

* **Decision**: Enforce runtime validation on all external API payloads with strict Zod schemas (`.strict()`) before data enters application state, throwing `ApiValidationError` on schema mismatches.
* **Justification**:
  1. **Preventing Untyped Corrupted State**: TypeScript interfaces only provide compile-time guarantees; runtime schema validation guarantees that corrupt, malicious, or malformed backend JSON payloads fail closed rather than rendering undefined/null reference errors in the UI.
