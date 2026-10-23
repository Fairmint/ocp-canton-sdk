# Fairmint OCF extension schemas

The hold pair, `TX_STOCK_HOLD` and `TX_STOCK_HOLD_CANCELLATION`, extends the Open Cap Format (OCF)
for the OpenCapTable-v35 register. The register's hold choices (`CapTable_PlaceHolds`,
`CapTable_CancelHolds`, `CapTable_Settle`) write the pair under derived IDs; the SDK reads it and
validates it against these schemas.

## Source

The files in this directory are a verbatim copy of `ocf-extension/schema/**` in
[Fairmint/open-captable-protocol-daml](https://github.com/Fairmint/open-captable-protocol-daml) at
commit `93ea933`. Do not edit them here: change the source repository, then copy the tree again and
update the commit named above.

The extension pins OCF at commit `6d8c93227de64fc014fe0a215af208f4a5432542`, the commit the
`libs/Open-Cap-Format-OCF` submodule is checked out at. The extension schemas reference OCF by that
commit's URL, while the submodule's own `$id`s use the `main` URL, so `src/utils/ocfZodSchemas.ts`
registers each OCF schema under both IDs. No vendored file is changed for that.

## Layout

| File                                                                | What it is                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `objects/transactions/hold/StockHold.schema.json`                   | `TX_STOCK_HOLD`: `quantity` required for `REGISTER_SETTLEMENT`, absent for `STOP_TRANSFER` |
| `objects/transactions/hold/StockHoldCancellation.schema.json`       | `TX_STOCK_HOLD_CANCELLATION`                                                               |
| `primitives/objects/transactions/hold/Hold.schema.json`             | `hold_type`, `reference` and `reason_text`                                                 |
| `primitives/objects/transactions/hold/HoldCancellation.schema.json` | `hold_id` and `reason_text`; no quantity, because a hold ends whole                        |
| `enums/HoldType.schema.json`                                        | `REGISTER_SETTLEMENT`, `STOP_TRANSFER`                                                     |
| `enums/ObjectType.schema.json`                                      | OCF's `ObjectType`, amended with the two values                                            |
| `primitives/objects/Object.schema.json`                             | OCF's `Object` primitive, whose `object_type` takes the amended enum                       |
| `files/TransactionsFile.schema.json`                                | OCF's `TransactionsFile`, whose items also take the two objects                            |

`scripts/copy-ocf-schemas.ts` copies the schemas to `dist/ocf-extension-schema/` when the package is
built.

## How the SDK uses it

- `src/utils/ocfZodSchemas.ts` loads the tree beside OCF's own schemas
  (`OCF_EXTENSION_OBJECT_SCHEMA_PATHS`), so `parseOcfObject` validates `TX_STOCK_HOLD` and
  `TX_STOCK_HOLD_CANCELLATION` like any OCF object. The directory is `OCP_OCF_EXTENSION_SCHEMA_DIR`,
  else the packaged `dist/ocf-extension-schema`, else this one.
- The hold records are read through `OpenCapTable.stockHold` and
  `OpenCapTable.stockHoldCancellation`, and `getByObjectType`. They are `ocf_data` of register
  contracts like every record, with a Daml `Date` for `date`, and the SDK has no converter that
  writes them: the register writes them under derived IDs.
- `HoldType` follows the v35 enum rule: the Daml constructors are `OcfHoldTypeRegisterSettlement`
  and `OcfHoldTypeStopTransfer`, in the order of this schema, and `OcfObjectType` appends the two
  object types. `test/utils/damlEnums.test.ts` reads both schemas from here to pin the generated
  enums.
- `test/utils/ocfExtensionSchemas.test.ts` pins the eight vendored files, the two commits this
  README names, the extension `$id`s and every reference into the OCF submodule, and
  `test/converters/stockHoldConverters.test.ts` validates the hold fixtures against the schemas.

## Refreshing

Copy `ocf-extension/schema/**` from the source repository over this directory, keep this README, and
update the commit named under Source and the one `ocfExtensionSchemas.test.ts` looks for in it. Then
run `npm run test:ci`. When the extension pins another OCF commit, move the
`libs/Open-Cap-Format-OCF` submodule to it too.
