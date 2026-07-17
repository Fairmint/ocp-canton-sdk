# Environment and observability

## Environment helpers

[`src/environment.ts`](../src/environment.ts) contains presets and validation for `localnet`,
`scratchnet`, `devnet`, `testnet`, `mainnet`, and `custom`. Hosted presets require explicit API URLs
and OAuth client credentials. `fromEnv()` reads the documented `CANTON_*` variables; never commit
those secrets.

Prefer constructor injection when an application already owns a configured `Canton` runtime. It
keeps authentication, logger, connection reuse, and lifecycle visible. Environment helpers are a
convenience, not a second source of network truth.

Factory coordinates are always a pair. The constructor rejects partial overrides, and the ledger
network must match an explicitly supplied logical environment.

## Observability

The injected constructor accepts `logger`, `metrics`, and `defaultContext`. Write calls can add or
override command context with `workflowId`, `commandId`, `submissionId`, and Canton trace context.

Observed write paths emit best-effort submitted, succeeded, and failed hooks. Hook failures do not
change a ledger command's outcome. Logs include operation, template, choice, identifiers, duration,
and an error summary; the integrating application must ensure its logger does not expose secrets or
sensitive OCF payloads.

For idempotency, use a stable command ID for the same logical operation and a distinct submission ID
for each submission attempt. Correlate failures with Canton completions or updates before retrying.
