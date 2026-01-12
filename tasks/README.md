# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Open Tasks

| Task                                                                                              | Status      | Priority | Description                             |
| ------------------------------------------------------------------------------------------------- | ----------- | -------- | --------------------------------------- |
| [Canton 3.4 Upgrade](./2025/12/2025.12.31-canton-3.4-upgrade.md)                                  | In Progress | High     | Update SDK for Canton 3.4 compatibility |
| [Milestone 2: OCP SDK Implementation](./2025/12/2025.12.17-milestone-2-ocp-sdk-implementation.md) | In Progress | High     | SDK support for all OCF object types    |
| [Library Refactoring and Testing](./2026/01/ai/2026.01.02-library-refactoring-and-testing.md)     | In Progress | Medium   | API ergonomics and type safety          |
| [Remaining Integration Tests](./2026/01/ai/2026.01.08-remaining-integration-tests.md)             | Open        | Medium   | Document blocked integration tests      |

## Task Structure

```
tasks/
├── README.md                    # This file - task index
├── 2025/
│   └── 12/
│       ├── 2025.12.17-milestone-2-ocp-sdk-implementation.md
│       ├── 2025.12.17-milestone-2-ocp-sdk-implementation/
│       │   └── comprehensive-integration-tests.md
│       └── 2025.12.31-canton-3.4-upgrade.md
└── 2026/
    └── 01/
        └── ai/
            ├── 2026.01.02-library-refactoring-and-testing.md
            └── 2026.01.08-remaining-integration-tests.md
```

## Task Naming Convention

Tasks follow the format: `YYYY.MM.DD-task-name.md`

- **Date**: When the task was created or target completion date
- **Task name**: Kebab-case description of the work

## Task Status

- **Open**: Not started
- **In Progress**: Actively being worked on
- **Blocked**: Waiting on dependencies
- **Complete**: Done

## Creating New Tasks

1. Create a file in the appropriate `tasks/YYYY/MM/` directory
2. Follow the template format from existing tasks
3. Update this README to add the task to the index
4. Link to parent tasks in other repos if applicable

---

_Last updated: 2026-01-12_
