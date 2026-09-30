# Step 1 scope

Implementation authority: the user-supplied POC_SPEC.md only, Sections 2–4, 16 and Section 18 Step 1.

- npm workspaces: apps/client, apps/api, apps/collaboration, packages/protocol, packages/sync, packages/shared.
- protocol is the only entity/operation DTO source. UUID v7, UTC ISO strings, date-only due, integer version and opaque cursor validation are shared.
- React bootstrap and Tauri 2 shell; NestJS/Fastify health endpoint; Hocuspocus boot/health endpoint. Document connections are disabled until Step 4 to avoid unaudited in-memory collaboration.
- SQLite schema contains only initialization pragmas. The Node SQLite script/test checks local development tooling; desktop persistence remains a future Tauri/SQLite task, and is not considered verified by this test.
- PostgreSQL configuration contains no structured model tables. Model persistence, Yjs integration, editing and sync functionality are deferred to the prescribed later steps.
- npm exact dependencies + package-lock.json, Rust exact dependencies + Cargo.lock, pinned runtime versions and PostgreSQL patch tag. No version-range relaxation for install failures.
- No Gate A/B/C verdict is made in Step 1.

The reattached POC specification differs in Sections 9.2 / 14 (same-field conflicts). Section 18 Step 1 and its model contracts are unchanged. The specification version is recorded separately; no conflict-resolution implementation or UI is included here. GREIVA_DESIGN_SPEC.md and GREIVA_REQUIREMENTS.md are not implementation authorities for this task.
