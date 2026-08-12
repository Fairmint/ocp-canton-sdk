# ocp-canton-sdk

## Step 0: Read the canonical docs

Read the Fairmint developer documentation before making architectural or operational changes:

- [OCP Canton SDK](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/canton-sdk.md)
- [OCP developer map](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/README.md)
- [Update lifecycle](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/update-lifecycle.md)
- [ADR-009: Batch cap-table updates](https://github.com/Fairmint/dev-docs/blob/main/adrs/ADR-009-Batch-Cap-Table-Updates.md)
- [ADR-010: OCF entity metadata registry](https://github.com/Fairmint/dev-docs/blob/main/adrs/ADR-010-OCF-Entity-Metadata-Registry.md)
- [Canton SDK landscape](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/canton/sdk-landscape.md)

Then inspect [`src/index.ts`](src/index.ts), declaration tests, the pinned OCF schemas, current
source, and integration tests as the source of truth for exact behavior. The dev docs are a map, not
a substitute for the source.

Before handing off a change, run the relevant checks in [`README.md`](README.md) and
[`package.json`](package.json).
