# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Open Tasks

### Milestone 2: OCP SDK Implementation

| Task                                                                                              | Status      | Priority | Description / Scope                                                |
| ------------------------------------------------------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------ |
| [Milestone 2: OCP SDK Implementation](./2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md) | In Progress | High     | Parent milestone - SDK support for all OCF types, testing strategy |
| [Batch Cap Table Updates](./2026/01/ai/2026.01.12-batch-cap-table-updates.md)                     | In Progress | High     | Batch API infrastructure (Phase 1-2 done, Phase 3 split)           |
| [Exercise & Conversion Types](./2026/01/ai/2026.01.20-ocf-exercise-conversion-types.md)           | Open        | High     | OCF exercise & conversion types (3 types)                          |
| [Valuation & Vesting Types](./2026/01/ai/2026.01.20-ocf-valuation-vesting-types.md)               | Open        | High     | OCF valuation & vesting types (4 types)                            |
| [Security Transfer Types](./2026/01/ai/2026.01.20-ocf-transfer-types.md)                          | Open        | Medium   | OCF security transfer types (3 types)                              |
| [Acceptance Types](./2026/01/ai/2026.01.20-ocf-acceptance-types.md)                               | Open        | Medium   | OCF acceptance types (4 types)                                     |
| [Stock Class Adjustments](./2026/01/ai/2026.01.20-ocf-stock-class-adjustments.md)                 | Open        | Medium   | OCF stock class adjustment types (4 types)                         |
| [Remaining Types](./2026/01/ai/2026.01.20-ocf-remaining-types.md)                                 | Open        | Low      | Remaining OCF types (9 types)                                      |

### SDK Refactoring & Improvements

| Task                                                                                                | Status             | Priority | Description                                                          |
| --------------------------------------------------------------------------------------------------- | ------------------ | -------- | -------------------------------------------------------------------- |
| [OcpClient API Simplification](./2026/01/ai/2026.01.16-ocp-client-api-simplification.md)            | Partially Complete | Medium   | Simplify OcpClient class, cleanup require() (context caching done)   |
| [Consolidate Entity Converters](./2026/01/ai/2026.01.16-consolidate-entity-converters.md)           | Partially Complete | Medium   | Extract and centralize duplicated entity conversion code             |
| [Observability & Tracing Support](./2026/01/ai/2026.01.16-observability-tracing-support.md)         | Open               | Medium   | Add correlation IDs, logging hooks, and trace propagation            |
| [Command Tracking & Retry Logic](./2026/01/ai/2026.01.16-command-tracking-retry-logic.md)           | Open               | Medium   | Command deduplication, retry with exponential backoff                |
| [Environment Configuration Patterns](./2026/01/ai/2026.01.16-environment-configuration-patterns.md) | Open               | Medium   | Environment presets for LocalNet/DevNet, configuration validation    |
| [Legacy Function Deprecation](./2026/01/ai/2026.01.16-legacy-function-deprecation.md)               | Open               | Low      | Deprecate per-entity functions replaced by batch API                 |
| [CouponMinter SDK Support](./2026/01/ai/2026.01.13-couponminter-sdk-support.md)                     | Partially Complete | Low      | Add CouponMinter helper functions (TPS helper done, full ops future) |

## Completed Tasks

| Task                                                                                                  | Completed  | Description                                                            |
| ----------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| [Property-Based Testing](./2026/01/ai/2026.01.16-property-based-testing.md)                           | 2026-01-20 | Property tests using fast-check for type conversion invariants         |
| [Library Refactoring and Testing](./2026/01/ai/2026.01.02-library-refactoring-and-testing.md)         | 2026-01-20 | API ergonomics, type safety, testing improvements - all phases done    |
| [Structured Error Types](./2026/01/ai/2026.01.16-structured-error-types.md)                           | 2026-01-20 | Implement OcpValidationError, OcpContractError for better DX           |
| [Type Guards for OCF Objects](./2026/01/ai/2026.01.16-type-guards-for-ocf-objects.md)                 | 2026-01-20 | Runtime type guards and validation utilities for OCF objects           |
| [PersonalAirdrop AmuletRules Override](./2026/01/2026.01.14-personalairdrop-amulet-rules-override.md) | 2026-01-16 | Support new `amuletRulesCidOverride` parameter (no SDK changes needed) |
| [Canton 3.4 Upgrade](./2025/12/2025.12.31-canton-3.4-upgrade.md)                                      | 2026-01-16 | Update SDK for Canton 3.4 compatibility                                |
| [Comprehensive Integration Tests](./2025/12/2025.12.30-comprehensive-integration-tests.md)            | 2026-01-12 | Expanded integration test coverage with dynamic contract deployment    |
| [Remaining Integration Tests](./2026/01/ai/2026.01.08-remaining-integration-tests.md)                 | 2026-01-13 | 13 delete tests enabled; 8 remaining blocked by infrastructure         |

## Superseded Tasks

| Task                                                                         | Superseded | Replaced By                             |
| ---------------------------------------------------------------------------- | ---------- | --------------------------------------- |
| [Remaining OCF Object Types](./2026/01/ai/2026.01.13-remaining-ocf-types.md) | 2026-01-20 | Split into 6 focused OCF type sub-tasks |

## Related ADRs

| ADR                                                                       | Status   | Description                              |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| [ADR-001: Batch Cap Table Updates](../adr/001-batch-cap-table-updates.md) | Proposed | Redesign SDK to use batch UpdateCapTable |

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
3. Update this README to add the task to the index
4. Link to parent tasks in other repos if applicable
