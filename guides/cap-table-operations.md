# Cap-table reads and updates

`OcpClient.OpenCapTable` groups OCF object and transaction readers, issuer authorization, and the
CapTable lifecycle. Every entity `get()` returns `{ data, contractId }`, where `data.object_type`
discriminates the OCF output type. `getByObjectType()` is the generic reader when the object type is
known only at runtime.

## Atomic updates

`capTable.update()` is the primary write path. It builds one `UpdateCapTable` exercise so related
creates, edits, and deletes succeed or fail atomically:

```ts
const batch = ocp.OpenCapTable.capTable.update({
  capTableContractId,
  actAs: [issuerParty],
  commandId: 'issuer-sync-42',
});

batch.create('stakeholder', stakeholder);
batch.create('stockClass', stockClass);
batch.edit('issuer', updatedIssuer);
const result = await batch.execute();
```

The entity keys and accepted OCF data types come from `CapTableBatch` and the registry under
[`src/functions/OpenCapTable/capTable/`](../src/functions/OpenCapTable/capTable/). Use a stable
`commandId` when retrying the same logical batch. `build()` is available when the application needs
to inspect or submit the command itself.

## Reads and lifecycle

- `capTable.classify(issuerPartyId)` reports whether this SDK's pinned package line has an active
  CapTable; it does not classify other deployed package versions.
- `capTable.getState(issuerPartyId)` returns the entity inventories for that active CapTable or
  `null`.
- `capTable.archive()` archives only when its contract preconditions are met. Clear entity maps with
  an update batch first.
- Readers accept `readAs` where the authenticated Ledger API identity differs from the visibility
  party.

## Issuer authorization

`issuerAuthorization.authorize()` and `.withdraw()` exercise the OCP Factory workflow.
`issuer.buildCreate()` builds the issuer command for a caller-owned transaction batch. Factory
coordinates must match the deployed package line; never reuse coordinates from another network.

Ledger submission can succeed even if a client times out. Query completions or updates before
retrying, and preserve stable command/submission identifiers for reconciliation.
