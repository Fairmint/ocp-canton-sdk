# OCF type documentation policy

This directory contains the public TypeScript types that mirror Open Cap Format data structures and
the OpenCapTable-v35 register's ledger state. Keep their comments aligned with the OCF version and
generated DAML package pinned by this repository; do not copy paths or version numbers from an older
package line.

## Sources of truth

1. The OCF submodule pinned at [`libs/Open-Cap-Format-OCF`](../../libs/Open-Cap-Format-OCF) contains
   the canonical JSON schemas for the package line used by this checkout.
2. The exact `@fairmint/open-captable-protocol-daml-js` version in `devDependencies` in
   [`package.json`](../../package.json) defines the generated DAML boundary used by this checkout
   (OpenCapTable-v35 and its reader interfaces). Its `peerDependencies` range defines supported
   consumer compatibility.
3. The Fairmint OCF extension, the hold pair `TX_STOCK_HOLD` and `TX_STOCK_HOLD_CANCELLATION`, is
   vendored verbatim in [`schemas/ocf-extension`](../../schemas/ocf-extension). It is not part of
   OCF itself.
4. The types in this directory expose the curated SDK representation and must not invent semantics
   absent from the canonical schema.

When schema and generated bindings differ, document the implementation constraint explicitly and
link the relevant schema or source code. Keep generated DAML types behind the package boundary
defined by [`src/index.ts`](../index.ts): `scripts/check-declarations.ts` fails when the root
declaration graph, comments included, names the generated package.

## What each file holds

| File          | Holds                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `native.ts`   | The OCF data types, with OCF's field names and string-literal enums                             |
| `output.ts`   | The named read results and the `OcfObject` union over every record kind, the hold pair included |
| `register.ts` | Native mirrors of the register's ledger state, and the inputs and results of its operations     |
| `setup.ts`    | The factory identity and the three-step setup's inputs and results                              |
| `common.ts`   | Params and result envelopes shared by every operation                                           |
| `branded.ts`  | Branded string types for contract, party, OCF and security IDs                                  |
| `daml.ts`     | `Pkg*` aliases of the generated types, for SDK internals only and not part of the public types  |

## Conventions for OpenCapTable-v35

- **Dates.** An OCF date is a `YYYY-MM-DD` string. The register stores it as a Daml `Date`, so the
  converters take the date's lexical first ten characters (`2024-01-15T23:30:00-05:00` is
  `2024-01-15`) and read back only an exact `YYYY-MM-DD`. A type never promises a time of day or a
  zone.
- **Numbers.** OCF numerics are decimal strings, canonical on read (`750`, not `750.0000000000`).
- **Records.** Every OCF record is stored as `{ context, ocf_data }`; the native OCF type describes
  `ocf_data` only. The `context` (`cap_table_id`, `issuer`, `system_operator`, `transfer_agent`) is
  `RegisterContext` in `register.ts`.
- **Enums.** Native enums are OCF's string values. The ledger's constructors follow one rule,
  `<TypeName><PascalCase(OCF value)>` in OCF's order, which `src/utils/damlEnums.ts` applies in both
  directions. Do not hand-write a constructor in a type or a converter.
- **Hold pair.** `OcfStockHold` and `OcfStockHoldCancellation` are written by the register's hold
  choices and only read by the SDK. They are in `OcfObject`, and a type or a guard that enumerates
  what callers may create, edit or delete leaves them out.
- **Ledger state.** Types in `register.ts` and `setup.ts` that mirror a template keep its Daml field
  names (snake_case, as the OCF types do), and call parameters are camelCase.

After changing public types or comments, run:

```bash
npm run typecheck
npm run test:declarations
```

See the public [architecture guide](https://github.com/Fairmint/ocp-canton-sdk/wiki/Architecture)
for source-of-truth boundaries.
