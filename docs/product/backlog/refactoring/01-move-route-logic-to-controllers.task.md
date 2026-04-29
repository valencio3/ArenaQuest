# Task: Decoupling Business Logic from Route Handlers (Controller Refactoring)

## 📋 Context & Rationale
Currently, our Hono route handlers in `apps/api/src/routes` are over-encumbered with business logic, input validation, and complex data orchestration. This architectural "fat router" pattern:
1.  **Hinders Testability**: Logic is tightly coupled to the HTTP lifecycle (Hono Context), making unit testing difficult without heavy mocking of the framework.
2.  **Reduces Reusability**: Business rules locked in routes cannot be easily leveraged by other parts of the system or future CLI/Internal tools.
3.  **Increases Cognitive Load**: Large route files make it harder to separate infrastructure concerns (routing, middleware, CORS) from the actual application logic.

By migrating to a **Controller-based architecture**, we align with the Clean Architecture principles already present in our Ports & Adapters setup.

## 🎯 Objectives
*   Extract application logic from route files into dedicated, context-agnostic Controller classes.
*   Standardize API response handling through a unified `ControllerResult<T>` pattern.
*   Enable 100% unit test coverage for business logic without requiring an HTTP server.

## ✅ Acceptance Criteria
- [ ] **Infrastructure Separation**: Route files (`*.router.ts`) must contain ONLY path definitions, middleware assignments, and mapping of `ControllerResult` to Hono HTTP responses.
- [ ] **Context Agnosticism**: Controllers MUST NOT import from `hono` or use the Hono `Context` object. They should receive plain objects/parameters and return typed results.
- [ ] **Dependency Injection**: Controllers must receive their required Repositories/Adapters via constructor injection.
- [ ] **Validation Mapping**: Zod schemas used for request bodies should be moved to the controller layer or shared type files.
- [ ] **Test Coverage**: Each new controller must have a corresponding `.spec.ts` file with unit tests for success and failure scenarios.

## 🛠️ Implementation Scope
1.  **`AdminMediaController`**:
    *   Target: `admin-media.router.ts`
    *   Responsibilities: Presigned URL generation, file metadata creation, status finalization.
2.  **`AdminTopicsController`**:
    *   Target: `admin-topics.router.ts`
    *   Responsibilities: Topic CRUD, tree manipulation logic.
3.  **`TopicsController`**:
    *   Target: `topics.router.ts`
    *   Responsibilities: Public read-only topic access.

## 📈 Definition of Done (DoD)
- [ ] Logic successfully migrated to `/src/controllers`.
- [ ] Routers refactored to thin "delegates".
- [ ] All existing integration tests pass.
- [ ] New unit tests for controllers pass with high coverage.
- [ ] No regressions in API behavior for frontend consumers.
