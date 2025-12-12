# Minimal documentation requirements

This repo intentionally keeps documentation **sparse** and **non-redundant**. Prefer **linking to an
existing source of truth** over copying content.

## Principles

- **One source of truth**: if guidance exists elsewhere in the repo, link to it.
- **Keep it small**: add docs only when it prevents repeated questions or avoids mistakes.
- **Docs live with ownership**:
  - Contributor workflow belongs in `CONTRIBUTING.md`.
  - Lint/format rules belong in `LINTING.md`.
  - Generated API docs belong in `README.docs.md`.

## Required docs (this repo)

- **`README.md`**
  - What this repo is (and who it’s for)
  - Link to end-user/public docs
  - Pointers to the rest of the repo documentation (no duplication)

- **`llms.txt`**
  - Single source of truth for AI context (what it is, key commands, links to docs)

- **Agent config files** (thin pointers to `llms.txt`)
  - `CLAUDE.md`
  - `AGENTS.md`
  - `GEMINI.md`

- **`CONTRIBUTING.md`**
  - Contribution workflow + coding conventions

- **`LINTING.md`**
  - Lint/format commands and expectations

- **`README.docs.md`**
  - How to generate/publish TypeDoc

- **`.circleci/README.md`** (if CircleCI is enabled)
  - Any CI behaviors that can surprise contributors (e.g. auto-fix commits)

## When to add documentation

Add (or extend) docs when you:

- Introduce **a new workflow** (new script, release step, CI job)
- Add **a non-obvious invariant** that contributors can break easily
- Add **a new subsystem** that needs a map (where code lives, how it fits together)

Otherwise, prefer keeping docs unchanged.
