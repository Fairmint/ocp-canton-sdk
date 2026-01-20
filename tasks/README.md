# OCP Canton SDK Tasks

This directory contains task documentation for the OCP Canton SDK project.

## Task Index

**See [`index.yaml`](./index.yaml) for the canonical task list.**

The YAML format is used instead of Markdown tables to reduce merge conflicts when multiple
contributors update task status simultaneously.

### Quick View

To view tasks by status, you can use:

```bash
# View open tasks
grep -A4 "^  - file:" tasks/index.yaml | head -50

# View all in-progress tasks
grep -B1 -A3 "status: in-progress" tasks/index.yaml
```

## Task Naming Convention

Tasks follow the pattern: `YYYY.MM.DD-task-name.md`

- Date prefix indicates when the task was created
- Use kebab-case for task names
- Sub-tasks go in a directory named after the parent task
- AI-generated tasks go in the `ai/` subdirectory

## Task Status Values

- **open**: Not started
- **in-progress**: Actively being worked on
- **partially-complete**: Some work done, more remains
- **blocked**: Waiting on dependencies
- **complete**: Done

## Priority Values

- **high**: Critical path or blocking other work
- **medium**: Important but not blocking
- **low**: Nice to have, do when time permits

## Creating New Tasks

1. Create a file in the appropriate `tasks/YYYY/MM/` directory
2. Follow the template format from existing tasks
3. Add an entry to `index.yaml` under `open_tasks`
4. Link to parent tasks in other repos if applicable

## Completing Tasks

1. Update the task file's status section
2. Move the entry from `open_tasks` to `completed_tasks` in `index.yaml`
3. Add the `completed` date field
