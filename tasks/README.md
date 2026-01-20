# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Open Tasks

### High Priority

- **[OCP SDK Implementation & Testing](./2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md)** — In Progress
  Add SDK support for all OCF object types, establish testing strategy

- **[Batch Cap Table Updates](./2026/01/ai/2026.01.12-batch-cap-table-updates.md)** — In Progress
  SDK redesign to use batch UpdateCapTable choice (Phase 1-3 done)

### Medium Priority

- **[Remaining OCF Object Types](./2026/01/ai/2026.01.13-remaining-ocf-types.md)** — Open
  Implement SDK support for 27 remaining OCF types from DAML spec

- **[OcpClient API Simplification](./2026/01/ai/2026.01.16-ocp-client-api-simplification.md)** — Partially Complete
  Simplify OcpClient class, cleanup require() (context caching done)

- **[Consolidate Entity Converters](./2026/01/ai/2026.01.16-consolidate-entity-converters.md)** — Partially Complete
  Extract and centralize duplicated entity conversion code

- **[Observability & Tracing Support](./2026/01/ai/2026.01.16-observability-tracing-support.md)** — Open
  Add correlation IDs, logging hooks, and trace propagation

- **[Command Tracking & Retry Logic](./2026/01/ai/2026.01.16-command-tracking-retry-logic.md)** — Open
  Command deduplication, retry with exponential backoff

- **[Environment Configuration Patterns](./2026/01/ai/2026.01.16-environment-configuration-patterns.md)** — Open
  Environment presets for LocalNet/DevNet, configuration validation

### Low Priority

- **[Property-Based Testing](./2026/01/ai/2026.01.16-property-based-testing.md)** — Open
  Add fast-check property tests for type conversion invariants

- **[Legacy Function Deprecation](./2026/01/ai/2026.01.16-legacy-function-deprecation.md)** — Open
  Deprecate per-entity functions replaced by batch API

- **[CouponMinter SDK Support](./2026/01/ai/2026.01.13-couponminter-sdk-support.md)** — Partially Complete
  Add CouponMinter helper functions (TPS helper done, full ops future)

## Completed Tasks

- **[Library Refactoring and Testing](./2026/01/ai/2026.01.02-library-refactoring-and-testing.md)** — 2026-01-20
  API ergonomics, type safety, testing improvements - all phases done

- **[Structured Error Types](./2026/01/ai/2026.01.16-structured-error-types.md)** — 2026-01-20
  Implement OcpValidationError, OcpContractError for better DX

- **[Type Guards for OCF Objects](./2026/01/ai/2026.01.16-type-guards-for-ocf-objects.md)** — 2026-01-20
  Runtime type guards and validation utilities for OCF objects

- **[PersonalAirdrop AmuletRules Override](./2026/01/2026.01.14-personalairdrop-amulet-rules-override.md)** — 2026-01-16
  Support new `amuletRulesCidOverride` parameter (no SDK changes needed)

- **[Canton 3.4 Upgrade](./2025/12/2025.12.31-canton-3.4-upgrade.md)** — 2026-01-16
  Update SDK for Canton 3.4 compatibility

- **[Comprehensive Integration Tests](./2025/12/2025.12.30-comprehensive-integration-tests.md)** — 2026-01-12
  Expanded integration test coverage with dynamic contract deployment

- **[Remaining Integration Tests](./2026/01/ai/2026.01.08-remaining-integration-tests.md)** — 2026-01-13
  13 delete tests enabled; 8 remaining blocked by infrastructure

## Related ADRs

- **[ADR-001: Batch Cap Table Updates](../adr/001-batch-cap-table-updates.md)** — Proposed
  Redesign SDK to use batch UpdateCapTable

---

## Task Naming Convention

Tasks follow the pattern: `YYYY.MM.DD-task-name.md`

- Date prefix indicates when the task was created
- Use kebab-case for task names
- Sub-tasks go in a directory named after the parent task

## Task Status

- **Open**: Not started
- **In Progress**: Actively being worked on
- **Partially Complete**: Some work done, more remains
- **Blocked**: Waiting on dependencies
- **Complete**: Done

## Creating New Tasks

1. Create a file in the appropriate `tasks/YYYY/MM/` directory
2. Follow the template format from existing tasks
3. Add an entry to the appropriate section above
4. Link to parent tasks in other repos if applicable
