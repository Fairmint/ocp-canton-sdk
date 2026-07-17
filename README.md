# ocp-canton-sdk

High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton.

The package exposes a curated API centered on `OcpClient`, OCF-shaped types and reads, issuer
authorization, and atomic cap-table updates. Generated DAML codecs and internal conversion helpers
are not supported deep-import surfaces; [`src/index.ts`](src/index.ts) defines the package boundary.

## Developer documentation

- [Getting started](guides/getting-started.md)
- [Cap-table reads and updates](guides/cap-table-operations.md)
- [Architecture and source-of-truth boundaries](guides/architecture.md)
- [Environment and observability](guides/environment-and-observability.md)

Read the guides for ownership and lifecycle guidance, then use the public entrypoint, declaration
tests, and current implementation for exact supported types and operations.

## Install

```bash
npm install @open-captable-protocol/canton
```

## Repository setup and checks

```bash
git submodule update --init --recursive libs/Open-Cap-Format-OCF
npm install
npm run fix
npm run test:ci
npm run test:declarations
npm run build
```

Run `npm run localnet:verify` when ledger, DAML, conversion, or integration behavior changes.
