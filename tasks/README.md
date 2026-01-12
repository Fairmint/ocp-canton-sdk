# Tasks

This directory contains all tracked tasks for the OCP Canton SDK.

## Open Tasks

| Task                                                                                                                        | Status      | Priority | Description                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------- |
| [OCP SDK Implementation & Testing](2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md)                                | In Progress | High     | Add SDK support for all OCF object types, establish testing strategy |
| [Comprehensive Integration Tests](2025/12/2025.12.17-milestone-2-ocp-sdk-implementation/comprehensive-integration-tests.md) | In Progress | High     | Expand integration test coverage with dynamic contract deployment    |
| [Library Refactoring and Testing](2026/01/ai/2026.01.02-library-refactoring-and-testing.md)                                 | In Progress | Medium   | API ergonomics, type safety improvements, testing gaps               |
| [Remaining Integration Tests](2026/01/ai/2026.01.08-remaining-integration-tests.md)                                         | Open        | Medium   | Document and resolve 21 skipped integration tests                    |

## Task Summary

### Milestone 2: OCP SDK Implementation

**Goal:** Complete SDK support for all OCF object types with robust testing.

- Part 1: Testing Strategy (LocalNet + mocks)
- Part 2: New OCF Object Types (high/medium/low priority)
- Part 3: SDK Validation via Cap Table Comparison

### Comprehensive Integration Tests

**Goal:** Full integration test coverage with dynamic DAML contract deployment.

- ✅ Contract deployment system
- ✅ All 17 OpenCapTable entity tests
- 🔄 Reports, Payments, Streams (simplified due to infrastructure requirements)

### Library Refactoring

**Goal:** Improve developer experience, type safety, and test coverage.

- ✅ Phase 2: Type Safety (trigger types, OCF transaction types)
- 🔄 Phase 1: Testing Foundation
- ⏳ Phase 3: API Ergonomics
- ⏳ Phase 4: Code Organization

### Remaining Integration Tests

**Goal:** Enable the 21 currently skipped integration tests.

- 13 archive/delete operations (needs `buildDelete*Command` exposure)
- 7 payment/stream tests (needs infrastructure)
- 1 report test (needs factory setup investigation)

## Directory Structure

```
tasks/
├── README.md                    # This file (task index)
├── 2025/
│   └── 12/
│       ├── 2025.12.17-milestone-2-ocp-sdk-implementation.md
│       └── 2025.12.17-milestone-2-ocp-sdk-implementation/
│           └── comprehensive-integration-tests.md
└── 2026/
    └── 01/
        └── ai/
            ├── 2026.01.02-library-refactoring-and-testing.md
            └── 2026.01.08-remaining-integration-tests.md
```

## Task Naming Convention

Tasks follow the pattern: `YYYY.MM.DD-task-name.md`

- Date prefix indicates when the task was created
- Use kebab-case for task names
- Sub-tasks go in a directory named after the parent task

## Status Legend

| Status      | Meaning                                   |
| ----------- | ----------------------------------------- |
| Open        | Not yet started                           |
| In Progress | Actively being worked on                  |
| Complete    | Finished and verified                     |
| Blocked     | Cannot proceed due to external dependency |

---

_Last updated: 2026-01-12_
