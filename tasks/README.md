# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Open Tasks

### Milestone 2: OCP SDK Implementation

- **[Milestone 2: OCP SDK Implementation](./2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md)**
  — In Progress Parent milestone - SDK support for all OCF types, testing strategy

### Integration Testing

- **[OCF Integration Test Data](./2026/01/ai/2026.01.21-ocf-integration-test-data.md)** — Open
  Source anonymized prod data for integration tests; round-trip validation for all OCF types

### SDK Improvements — Immediate Priority (Pre-User Adoption)

- **[API Consistency Refactor](./2026/01/ai/2026.01.21-api-consistency-refactor.md)** — Open (High)
  Unify API patterns, document when to use batch vs direct methods

- **[Centralize Converters](./2026/01/ai/2026.01.21-centralize-converters.md)** — Open (High) Create
  `src/converters/` with bidirectional OCF↔DAML conversions

- **[Standardize Error Usage](./2026/01/ai/2026.01.21-standardize-error-usage.md)** — Open (Medium)
  Replace `new Error()` with appropriate OCP error types throughout codebase

### SDK Improvements — Short-term

- **[Converter File Organization Pattern](./2026/01/ai/2026.01.21-converter-file-organization.md)**
  — Open (High) Enforce per-entity folder organization for converters, not centralized files

- **[OcpClient API Simplification](./2026/01/ai/2026.01.16-ocp-client-api-simplification.md)** —
  Partially Complete Simplify OcpClient class, cleanup require() (context caching done)

- **[Input Validation Layer](./2026/01/ai/2026.01.21-input-validation-layer.md)** — Open (Medium)
  Comprehensive validation before DAML conversion

### SDK Improvements — Longer-term

- **[Observability & Tracing Support](./2026/01/ai/2026.01.16-observability-tracing-support.md)** —
  Open Add correlation IDs, logging hooks, and trace propagation

- **[Command Tracking & Retry Logic](./2026/01/ai/2026.01.16-command-tracking-retry-logic.md)** —
  Open Command deduplication, retry with exponential backoff

- **[Environment Configuration Patterns](./2026/01/ai/2026.01.16-environment-configuration-patterns.md)**
  — Open Environment presets for LocalNet/DevNet, configuration validation

- **[CouponMinter SDK Support](./2026/01/ai/2026.01.13-couponminter-sdk-support.md)** — Partially
  Complete Add CouponMinter helper functions (TPS helper done, full ops future)

- **[JSDoc Coverage](./2026/01/ai/2026.01.21-jsdoc-coverage.md)** — Open (Low) Add comprehensive
  documentation to public API

- **[Migration Guide](./2026/01/ai/2026.01.21-migration-guide.md)** — Open (Low) Document migration
  from legacy to batch API

- **[Batch Size Limits](./2026/01/ai/2026.01.21-batch-size-limits.md)** — Open (Low) Add
  configurable limits and pagination support

## Completed Tasks

- **[Round-trip Tests](./2026/01/ai/2026.01.21-round-trip-tests.md)** — Complete (2026-01-22)
  Property-based and round-trip tests for converters - core requirements already implemented

- **[Add damlToOcf Dispatcher](./2026/01/ai/2026.01.21-daml-to-ocf-dispatcher.md)** — Complete
  (2026-01-21) Generic `getEntityAsOcf<T>()` function to DRY up read operations

- **[Exercise & Conversion Types](./2026/01/ai/2026.01.20-ocf-exercise-conversion-types.md)** —
  Complete (2026-01-21) OCF exercise & conversion types (3 types) - PR #185

- **[Security Transfer Types](./2026/01/ai/2026.01.20-ocf-transfer-types.md)** — Complete
  (2026-01-21) OCF security transfer types (3 types) - PR #183

- **[Stock Class Adjustments](./2026/01/ai/2026.01.20-ocf-stock-class-adjustments.md)** — Complete
  (2026-01-21) OCF stock class adjustment types (4 types) - PR #186

- **[Acceptance Types](./2026/01/ai/2026.01.20-ocf-acceptance-types.md)** — Complete (2026-01-21)
  OCF acceptance types with converters and tests (4 types)

- **[Remaining Types](./2026/01/ai/2026.01.20-ocf-remaining-types.md)** — Complete (2026-01-21)
  Remaining OCF types (stakeholder events) with unit tests - PR #188

- **[Valuation & Vesting Types](./2026/01/ai/2026.01.20-ocf-valuation-vesting-types.md)** — Complete
  (2026-01-21) OCF valuation & vesting types (4 types) - PR #187

- **[Batch Cap Table Updates](./2026/01/ai/2026.01.12-batch-cap-table-updates.md)** — Complete
  (2026-01-21) Batch API infrastructure - all phases complete, cleanup in separate task

- **[Consolidate Entity Converters](./2026/01/ai/2026.01.16-consolidate-entity-converters.md)** —
  Complete (2026-01-20) Extract and centralize duplicated entity conversion code

- **[Legacy Function Deprecation](./2026/01/ai/2026.01.16-legacy-function-deprecation.md)** —
  Complete (2026-01-20) Removed public exports of legacy \*DataToDaml functions

- **[Library Refactoring and Testing](./2026/01/ai/2026.01.02-library-refactoring-and-testing.md)**
  — Complete (2026-01-20) API ergonomics, type safety, testing improvements - all phases done

- **[Structured Error Types](./2026/01/ai/2026.01.16-structured-error-types.md)** — Complete
  (2026-01-20) Implement OcpValidationError, OcpContractError for better DX

- **[Type Guards for OCF Objects](./2026/01/ai/2026.01.16-type-guards-for-ocf-objects.md)** —
  Complete (2026-01-20) Runtime type guards and validation utilities for OCF objects

- **[PersonalAirdrop AmuletRules Override](./2026/01/2026.01.14-personalairdrop-amulet-rules-override.md)**
  — Complete (2026-01-16) Support new `amuletRulesCidOverride` parameter (no SDK changes needed)

- **[Canton 3.4 Upgrade](./2025/12/2025.12.31-canton-3.4-upgrade.md)** — Complete (2026-01-16)
  Update SDK for Canton 3.4 compatibility

- **[Comprehensive Integration Tests](./2025/12/2025.12.30-comprehensive-integration-tests.md)** —
  Complete (2026-01-12) Expanded integration test coverage with dynamic contract deployment

- **[Remaining Integration Tests](./2026/01/ai/2026.01.08-remaining-integration-tests.md)** —
  Complete (2026-01-13) 13 delete tests enabled; 8 remaining blocked by infrastructure

- **[OCP Protocol Review](./2026/01/ai/2026.01.21-ocp-protocol-review.md)** — Complete (2026-01-21)
  Comprehensive review of SDK architecture with improvement recommendations

- **[Centralize Converters](./2026/01/ai/2026.01.21-centralize-converters.md)** — Cancelled
  (2026-01-21) Superseded - conflicts with per-entity folder architecture in llms.txt

## Related ADRs

- **[ADR-001: Batch Cap Table Updates](../adr/001-batch-cap-table-updates.md)** — Proposed Redesign
  SDK to use batch UpdateCapTable

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
