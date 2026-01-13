# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the OCP Canton SDK.

## ADR Index

| ADR                                         | Status   | Date       | Summary                                                  |
| ------------------------------------------- | -------- | ---------- | -------------------------------------------------------- |
| [ADR-001](./001-batch-cap-table-updates.md) | Proposed | 2026-01-12 | Batch Cap Table Updates API using fluent builder pattern |

## What is an ADR?

An Architecture Decision Record (ADR) documents a significant architectural decision, including:

- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Consequences**: What are the trade-offs?

## ADR Lifecycle

| Status     | Meaning                               |
| ---------- | ------------------------------------- |
| Proposed   | Under discussion, not yet approved    |
| Accepted   | Approved and ready for implementation |
| Rejected   | Considered but not adopted            |
| Superseded | Replaced by a newer ADR               |

## Creating a New ADR

1. Create a new file: `adr/NNN-short-title.md` (NNN = next number)
2. Use the template structure from existing ADRs
3. **Update this README** to add the ADR to the index table above
4. Link from relevant task files

## Template

```markdown
# ADR-NNN: Title

**Status**: Proposed  
**Date**: YYYY-MM-DD  
**Authors**: Name  
**Reviewers**: @reviewer

## Context

[Describe the problem and background]

## Decision

[Describe the decision and approach]

## Consequences

### Positive

- [Benefits]

### Negative

- [Trade-offs]

## References

- [Related links]
```
