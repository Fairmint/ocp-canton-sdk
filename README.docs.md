# OCP Canton SDK - Documentation

This package publishes API docs to GitHub Pages using TypeDoc.

## Local setup

- Node 18+
- Install deps:

```bash
npm i
```

- Generate docs locally:

```bash
npm run docs
open docs/index.html
```

## CI publishing

A workflow at `.github/workflows/docs.yml` builds docs on pushes to `main` and deploys to GitHub
Pages.

### One-time repo setup

- In repository Settings → Pages, set:
  - Build and deployment: "GitHub Actions"
- Ensure Actions permissions allow GitHub Pages deployments.

No secrets are required; it uses `GITHUB_TOKEN` with pages:write.

## Customizing

- Edit `typedoc.json` to change entry points, output dir, and visibility filters.
- By default, `src/index.ts` is the entry point and output goes to `docs/`.

## Troubleshooting

- If docs are empty, ensure `src/index.ts` re-exports public symbols.
- If CI fails on `npm ci`, ensure `package-lock.json` is up to date.
