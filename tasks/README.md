# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Open Tasks

| Task                                                                                                       | Status      | Priority | Description                                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------- |
| [Batch Cap Table Updates](./2026/01/ai/2026.01.12-batch-cap-table-updates.md)                              | Open        | High     | SDK redesign to use batch UpdateCapTable choice                      |
| [Canton 3.4 Upgrade](./2025/12/2025.12.31-canton-3.4-upgrade.md)                                           | Blocked     | High     | Update SDK for Canton 3.4 compatibility                              |
| [OCP SDK Implementation & Testing](./2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md)             | In Progress | High     | Add SDK support for all OCF object types, establish testing strategy |
| [Remaining OCF Object Types](./2026/01/ai/2026.01.13-remaining-ocf-types.md)                               | Open        | Medium   | Implement SDK support for 27 remaining OCF types from DAML spec      |
| [PersonalAirdrop AmuletRules Override](./2026/01/2026.01.14-personalairdrop-amulet-rules-override.md)      | Blocked     | Medium   | Support new `amuletRulesCidOverride` parameter (awaiting NPM pkg)    |
| [Library Refactoring and Testing](./2026/01/ai/2026.01.02-library-refactoring-and-testing.md)              | In Progress | Medium   | API ergonomics, type safety improvements, testing gaps               |
| [Observability & Tracing Support](./2026/01/ai/2026.01.16-observability-tracing-support.md)                | Open        | Medium   | Add correlation IDs, logging hooks, and trace propagation            |
| [Command Tracking & Retry Logic](./2026/01/ai/2026.01.16-command-tracking-retry-logic.md)                  | Open        | Medium   | Command deduplication, retry with exponential backoff                |
| [Environment Configuration Patterns](./2026/01/ai/2026.01.16-environment-configuration-patterns.md)        | Open        | Medium   | Environment presets for LocalNet/DevNet, configuration validation    |
| [CouponMinter SDK Support](./2026/01/ai/2026.01.13-couponminter-sdk-support.md)                            | Open        | Low      | Add CouponMinter helper functions and full SDK integration           |
| [CouponMinter canMintCouponsNow Helper](../project/tasks/2025.01.13_coupon_minter_can_mint_helper.task.md) | Open        | Low      | Client-side utility to check TPS rate limits before minting          |
| [Health Check Integration](./2026/01/ai/2026.01.16-health-check-integration.md)                            | Open        | Low      | Service health check utilities and wait-for-ready patterns           |
| [PQS Query Store Support](./2026/01/ai/2026.01.16-pqs-query-store-support.md)                              | Open        | Low      | Evaluate PQS integration for optimized read queries                  |

## Completed Tasks

| Task                                                                                       | Completed  | Description                                                         |
| ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------- |
| [Comprehensive Integration Tests](./2025/12/2025.12.30-comprehensive-integration-tests.md) | 2026-01-12 | Expanded integration test coverage with dynamic contract deployment |
| [Remaining Integration Tests](./2026/01/ai/2026.01.08-remaining-integration-tests.md)      | 2026-01-13 | 13 delete tests enabled; 8 remaining blocked by infrastructure      |

## Related ADRs

| ADR                                                                       | Status   | Description                              |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| [ADR-001: Batch Cap Table Updates](../adr/001-batch-cap-table-updates.md) | Proposed | Redesign SDK to use batch UpdateCapTable |

## Task Structure

```
tasks/
├── README.md                    # This file - task index
├── 2025/
│   └── 12/
│       ├── 2025.12.17-milestone-2-ocp-sdk-implementation.md
│       ├── 2025.12.30-comprehensive-integration-tests.md
│       └── 2025.12.31-canton-3.4-upgrade.md
└── 2026/
    └── 01/
        ├── 2026.01.14-personalairdrop-amulet-rules-override.md
        └── ai/
            ├── 2026.01.02-library-refactoring-and-testing.md
            ├── 2026.01.08-remaining-integration-tests.md
            ├── 2026.01.12-batch-cap-table-updates.md
            ├── 2026.01.13-couponminter-sdk-support.md
            ├── 2026.01.13-remaining-ocf-types.md
            ├── 2026.01.16-command-tracking-retry-logic.md
            ├── 2026.01.16-environment-configuration-patterns.md
            ├── 2026.01.16-health-check-integration.md
            ├── 2026.01.16-observability-tracing-support.md
            └── 2026.01.16-pqs-query-store-support.md
```

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
