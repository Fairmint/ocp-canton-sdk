# Getting started

`@open-captable-protocol/canton` provides OCF-shaped reads and atomic Open Cap Table writes over the
low-level `@fairmint/canton-node-sdk` clients.

## Install and construct a client

```bash
npm install @open-captable-protocol/canton \
  @fairmint/canton-node-sdk \
  @fairmint/open-captable-protocol-daml-js
```

Keep peer dependency versions within the ranges declared by this package. The usual construction
path makes client ownership explicit:

```ts
import { Canton } from '@fairmint/canton-node-sdk';
import { OcpClient } from '@open-captable-protocol/canton';

const canton = new Canton({ network: 'localnet' });
const ocp = new OcpClient({
  ledger: canton.ledger,
  validator: canton.validator,
  factory: {
    contractId: process.env.OCP_FACTORY_CONTRACT_ID!,
    templateId: process.env.OCP_FACTORY_TEMPLATE_ID!,
  },
  environment: 'localnet',
});
```

`ledger` is required. `validator` is optional for cap-table-only behavior. Local, scratch, custom,
or otherwise separately deployed networks need the coordinates of their existing OCP Factory;
factory deployment is an environment bootstrap concern, not a public deep import from this SDK.

The static helpers `OcpClient.forLocalNet`, `forDevNet`, `forTestNet`, `forMainNet`, `create`, and
`fromEnv` can build the low-level clients from explicit or environment configuration. See
[environment and observability](environment-and-observability.md) before using those shortcuts.

## Public boundary

The supported API is the curated export list in [`src/index.ts`](../src/index.ts). Do not
deep-import generated DAML codecs or internal converters: they change with the pinned contract
package and can leak generator-specific types into applications.

Continue with [cap-table operations](cap-table-operations.md).
