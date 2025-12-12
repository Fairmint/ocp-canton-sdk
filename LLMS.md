# LLM / AI assistant notes

This file is for AI assistants (and humans) making changes to this repo.

## Start here

- **Project conventions and design guidance**: see `README.md`
- **Contribution + coding patterns**: see `CONTRIBUTING.md`
- **Lint/format**: see `LINTING.md`

## Validation (run locally)

- `npm test` (runs typecheck + tests)
- If you only need TypeScript compilation against the library build config: `tsc --noEmit`

## Repo-specific constraints

- **Strict TypeScript**: do not introduce `any`/`unknown` or broad assertions.
- **Fail fast**: validate inputs early; do not hide malformed data with fallback values.
- **Prefer links over duplication**: if you need to explain a convention, link to an existing doc.
