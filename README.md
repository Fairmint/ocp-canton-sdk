# ocp-canton-sdk

High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton Network.

## Documentation

- [OCP Canton SDK](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/canton-sdk.md)
- [OCP developer map](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/README.md)
- [Update lifecycle](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/ocp/update-lifecycle.md)
- [ADR-009: Batch cap-table updates](https://github.com/Fairmint/dev-docs/blob/main/adrs/ADR-009-Batch-Cap-Table-Updates.md)
- [ADR-010: OCF entity metadata registry](https://github.com/Fairmint/dev-docs/blob/main/adrs/ADR-010-OCF-Entity-Metadata-Registry.md)
- [Canton SDK landscape](https://github.com/Fairmint/dev-docs/blob/main/docs/onchain/canton/sdk-landscape.md)

[`src/index.ts`](src/index.ts) defines the supported package boundary; use current source,
declaration tests, and integration tests for exact types and behavior.

## Install

```bash
npm install @open-captable-protocol/canton \
  @fairmint/canton-node-sdk \
  @fairmint/open-captable-protocol-daml-js
```

```ts
import { Canton } from '@fairmint/canton-node-sdk';
import { OcpClient } from '@open-captable-protocol/canton';

const canton = new Canton({ network: 'localnet' });
const ocp = new OcpClient({
  ledger: canton.ledger,
  validator: canton.validator,
});
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
