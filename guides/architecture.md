# Architecture and sources of truth

The SDK sits between OCF JSON and OpenCapTable DAML contracts:

```text
application -> OcpClient -> canton-node-sdk -> Canton Ledger JSON API
                    |
                    +-> OCF validation and OCF/DAML conversion
```

## Sources of truth

1. The OCF schemas pinned in [`libs/Open-Cap-Format-OCF`](../libs/Open-Cap-Format-OCF) define public
   OCF fields and semantics.
2. The generated DAML package version in [`package.json`](../package.json) defines the contract
   types and choices used by this checkout.
3. [`src/index.ts`](../src/index.ts) defines the supported TypeScript package surface.
4. Unit, declaration, and LocalNet integration tests prove conversion and ledger behavior.

Public OCF input/output types live under [`src/types/`](../src/types/). Per-entity folders under
[`src/functions/OpenCapTable/`](../src/functions/OpenCapTable/) own OCF/DAML conversion and reads.
The CapTable registry and dispatchers compose those entities for atomic updates and state reads.

Do not infer a contract ID, template ID, field, or choice from older documentation. Inspect the
pinned packages and current source. When OCF and the deployed DAML package differ, validate early
and describe the implementation constraint without inventing new OCF semantics.

## Compatibility changes

Upgrading the OCF submodule or DAML JS peer is a coordinated compatibility change. Update types and
converters, run declaration and unit suites, then run LocalNet integration and production-shaped
round-trip fixtures. A successful TypeScript build alone does not prove ledger compatibility.
