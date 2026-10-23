# ocp-canton-sdk

High-level TypeScript SDK for Open Cap Table Protocol contracts on Canton Network. Since 0.9.0 it
targets the **OpenCapTable-v35** register only.

## Developer documentation

The public [GitHub wiki](https://github.com/Fairmint/ocp-canton-sdk/wiki) is the canonical guide for
getting started, cap-table operations, architecture, environments, observability, and accepted
decisions. [`src/index.ts`](src/index.ts) defines the supported package boundary; use current
source, declaration tests, and integration tests for exact types and behavior.

## What changed in 0.9.0

0.9.0 is a breaking release. The v34 root map, the `UpdateCapTable` batch (`CapTableBatch`), the
positions code and the v34 issuer-creation API are removed; nothing of v34 remains to fall back on.

- **One register.** The SDK builds against `@fairmint/open-captable-protocol-daml-js` 0.4.0
  (`OpenCapTable-v35`). A cap table is a `CapTable` anchor, one contract per OCF record (each
  `{ context, ocf_data }`), one `StockSecurity` state per stock security, one `StockClassEpoch` per
  class and the `OcfIdShard`s that claim IDs. The 51 OCF record kinds convert in their v35 shapes:
  49 are written by the SDK, and the Fairmint hold pair (`TX_STOCK_HOLD`,
  `TX_STOCK_HOLD_CANCELLATION`) is written by the register and only read. v35 targets DevNet, and
  the SDK refuses MainNet.
- **Two DARs, in upload order.** `OpenCapTableApi-v01` (the reader interfaces, never upgraded)
  first, then `OpenCapTable-v35`, which data-depends on it. `getOpenCapTableDarPaths()` from
  `@fairmint/open-captable-protocol-daml-js/openCapTableDarPath` lists both in that order.
- **Three-step setup** (`ocp.OpenCapTable.setup`). `system_operator` authorizes an issuer and pins
  its transfer agent, the transfer agent accepts, and the issuer creates the cap table with the
  authorization disclosed. The factory is named by its identity (`factoryId` and `systemOperator`),
  not by a contract ID.
- **Apply and Restate.** Every write is `CapTable_Apply` (create, in date order) or
  `CapTable_Restate` (edit, delete, restate a state), submitted by the transfer agent.
  `CapTableApply` and `CapTableRestate` build them, and there are builders and result readers for
  every other anchor choice: `buildPlaceHoldsCommand`, `buildCancelHoldsCommand`,
  `buildSettleCommand`, `buildFreezeClassCommand`, `buildUnfreezeClassCommand`,
  `buildBeginTeardownCommand`, `buildPurgeCommand` and `buildCloseCommand`.
- **Interface-view reader and key index.** `register.readRegister` streams the active contract set
  through the `OcfObject` and `RegisterContract` interface views at one offset and admits a contract
  only if it is a v35 template whose signatories are exactly the issuer, `system_operator` and
  transfer agent of its context. Everything else is reported, not indexed. `RegisterIndex` finds
  records, states, epochs and shards by key.
- **The register's rules, off the ledger.** The `register` namespace reproduces what the ledger
  computes, against the shared vectors in `test/fixtures/register/v35-test-vectors.json`: derived
  IDs (`deriveId`), claim hashes and shard resolution, the shared floor function (`floorMulDiv`),
  split stepping and reader-side scaling, vesting, input resolution (`resolveInputs`) and batch
  sizing within every ledger cap and the SDK's 8 MiB budget (`planBatches`).
- **One writer per issuer.** `RegisterWriter` (`ocp.OpenCapTable.register.writer`) takes a class-,
  plan- or instrument-scoped lock, brings its index current, runs the off-ledger checks, submits as
  the transfer agent and keeps the lock until the command's outcome is known. It never resubmits.
  Give every process that writes a book one shared `WriterLockProvider`; the default in-process
  provider covers one process.
- **Off-ledger checks.** The checks the ledger no longer makes run in the writer by default
  (`register.checkWrite`): class, issuer and plan-pool ceilings, orphaned references, warrant,
  convertible and equity-compensation lifecycle, future-dated stock events, and the split procedure
  (`register.recordSplit`, which freezes the class while it checks).
- **Replication and teardown** (`@open-captable-protocol/canton/replication`). `planReplication` and
  `executeReplication` bring a book to its source records through `CapTable_Apply` and
  `CapTable_Restate` in date order with the split procedure, each restatement checked against the
  replayed OCF (`register.replayOcf`) and records in the book's derived form skipped. A book the
  restatement limits refuse to correct is rebuilt: `checkTeardownReady`, `planStopReplacement`,
  `reconcileStops` and `planPurge`.
- **Holds and settlement.** There is no delivery proof. `CapTable_Settle` returns a `SettleResult`,
  and `readSettleResult` or `findSettleResults` turn it into `DeliveredTerms`. See below.
- **Dates and enums.** Daml `Date` fields are the OCF date's lexical `YYYY-MM-DD`, with no `Date`
  object and no UTC conversion: `2024-01-15T23:30:00-05:00` is written as `2024-01-15`, and only an
  exact `YYYY-MM-DD` is read. v35 names each enum constructor `<TypeName><PascalCase(OCF value)>` in
  OCF's order, and the converters apply that rule in both directions.
- **Errors.** `UnknownMutationOutcomeError` from `@fairmint/canton-node-sdk` surfaces as an
  `OcpContractError` with code `OUTCOME_UNKNOWN` and the transport error as its `cause`; a
  deterministic rejection surfaces as `CHOICE_FAILED`. Neither is retried by the SDK: the writer
  polls the command's completion, and `RegisterWriter.reconcile` settles one it could not.

Where the 0.8 API went (methods are on `ocp.OpenCapTable`):

| 0.8                                                              | 0.9                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `capTable.update`, `CapTableBatch`, `buildUpdateCapTableCommand` | `register.writer(...).apply` and `.restate`, or `capTable.apply` and `capTable.restate`     |
| `issuer.buildCreate`, `buildCreateIssuerCommand`                 | `setup.authorizeIssuer`, `setup.acceptAuthorization`, `setup.buildCreateCapTable`           |
| `issuerAuthorization.authorize` and `.withdraw`                  | `setup.authorizeIssuer` and `setup.withdrawAuthorization`                                   |
| `capTable.classify`, `capTable.getState`                         | `register.read` and `register.findCapTables`, giving a `RegisterIndex` per book             |
| `capTable.archive`                                               | `capTable.buildBeginTeardown`, `planPurge` and `capTable.buildPurge`, `capTable.buildClose` |
| `factory: { contractId, templateId }`                            | `factory: { factoryId, systemOperator }`                                                    |

## Install

```bash
npm install @open-captable-protocol/canton \
  @fairmint/canton-node-sdk \
  @fairmint/open-captable-protocol-daml-js
```

Peer dependencies: `@fairmint/canton-node-sdk` `>=0.0.266 <0.1.0` and
`@fairmint/open-captable-protocol-daml-js` `>=0.4.0 <0.5.0`.

## Minimal example

Create a cap table through the three-step setup, read its book and write a record. The parties are
three distinct Canton parties: the issuer, `system_operator` and the issuer's transfer agent.

```ts
import { Canton } from '@fairmint/canton-node-sdk';
import { OcpClient } from '@open-captable-protocol/canton';

const canton = new Canton({ network: 'localnet' });
const ocp = new OcpClient({
  ledger: canton.ledger,
  // A factory is named by its identity: each authorization consumes it and creates the next
  factory: { factoryId: 'acme', systemOperator },
});
const { setup, register } = ocp.OpenCapTable;

// Once per stack that has no factory (LocalNet, staging). DevNet's identity ships with the Daml package
await setup.createFactory();

// 1. system_operator authorizes the issuer and pins its transfer agent
const authorized = await setup.authorizeIssuer({ issuer, transferAgent });
// 2. the transfer agent accepts
const { authorization } = await setup.acceptAuthorization({
  authorizationContractId: authorized.authorizationContractId,
  transferAgent,
});
// 3. the issuer creates the cap table, with the authorization disclosed
const { command, disclosedContracts, actAs } = setup.buildCreateCapTable({
  authorization,
  transferAgent,
  issuerData,
});
const created = await ocp.ledger.submitAndWaitForTransaction({
  commands: [command],
  disclosedContracts,
  actAs,
});
const { capTableContractId } = setup.readCreateCapTableResult(created);

// Read the book as its transfer agent: only genuine v35 contracts, indexed by key
const snapshot = await register.read({ readAs: transferAgent, capTableId: authorized.capTableId });
const [index] = snapshot.books;
if (index === undefined) throw new Error('The cap table is not on the ledger');

// One writer per issuer: scoped locks, the off-ledger checks, and a known outcome before the lock is released
const writer = register.writer({ context: index.context, transferAgent, index });
await writer.apply([{ kind: 'record', type: 'stakeholder', data: stakeholder }]);
```

`issuerData` is an `OcfIssuer` and `stakeholder` an `OcfStakeholder`. Records read back as OCF
through `ocp.OpenCapTable.<entity>.get` or `ocp.OpenCapTable.getByObjectType`.

## Holds and settlement

The register places and draws stock holds itself. `buildPlaceHoldsCommand` puts lots on a
`REGISTER_SETTLEMENT` or `STOP_TRANSFER` hold, `buildSettleCommand` draws the settlement's lots and
cancels the holds it does not draw, and `buildCancelHoldsCommand` releases whole holds. Holds are
written as the `TX_STOCK_HOLD` and `TX_STOCK_HOLD_CANCELLATION` records of the Fairmint OCF
extension.

A settlement returns what it delivered; nothing else proves delivery:

```ts
import { findSettleResults, readSettleResult } from '@open-captable-protocol/canton';

// From the TA's own submission
const terms = readSettleResult(response); // DeliveredTerms: lots, quantities, buyer and balance states
// Or from any ledger-effects transaction, including a settlement nested under another choice
const settlements = findSettleResults(transaction);
```

`register.planDraw` computes the same terms from a lot's state, so a caller can compare what it
expected with what the ledger delivered. A split dated after a settlement hold voids it: a draw of
it is refused, and `buildCancelHoldsCommand` releases it.

## Repository setup and checks

```bash
git submodule update --init --recursive libs/Open-Cap-Format-OCF
npm install
npm run fix
npm run test:ci
npm run test:declarations
npm run build
```

Run `npm run localnet:verify` when ledger, DAML, conversion, or integration behavior changes. It
starts LocalNet with the shared-secret profile, whose ParticipantAdmin user the harness needs to
allocate the issuer, `system_operator` and transfer agent parties, then runs the integration suites
(`test:integration:ci`). The harness uploads both DARs, interfaces first: `OpenCapTableApi-v01`,
then `OpenCapTable-v35`. It takes them from the installed daml-js package or a sibling
`open-captable-protocol-daml` checkout, and `OPEN_CAP_TABLE_DAR_PATH` overrides the
`OpenCapTable-v35` DAR.

Vendored copies of the register's source files must be refreshed from
[Fairmint/open-captable-protocol-daml](https://github.com/Fairmint/open-captable-protocol-daml),
never edited here: `test/fixtures/register/v35-test-vectors.json` and `schemas/ocf-extension/`.
