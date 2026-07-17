# ocp-canton-sdk

High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton Network.

## Developer documentation

The public [GitHub wiki](https://github.com/Fairmint/ocp-canton-sdk/wiki) is the canonical guide for
getting started, cap-table operations, architecture, environments, observability, and accepted
decisions. [`src/index.ts`](src/index.ts) defines the supported package boundary; use current
source, declaration tests, and integration tests for exact types and behavior.

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
