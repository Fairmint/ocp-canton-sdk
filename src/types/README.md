# Types Commenting Policy

This folder contains TypeScript types that mirror OCF (Open Cap Format) data structures. All
comments in these TypeScript types MUST mirror the comments in the DAML implementation, which itself
mirrors the OCF JSON Schemas.

Authoritative source of truth order:

1. OCF JSON Schemas under `Open-Cap-Format-OCF/schema/` (canonical source)
2. DAML implementation under `open-captable-protocol-daml/OpenCapTable-v25/daml/` (copies schema
   comments verbatim and adds links)
3. This `src/types` directory (must copy DAML comments verbatim)

Rules:

- For every type/interface/enum: add the object/type header comment from DAML, including the short
  description and the OCF `$id` raw GitHub URL.
- For every field: copy the field-level comment(s) from DAML in the same order and wording. Keep
  them concise and high-signal.
- Do not invent or alter semantics. If the schema/DAML updates, update the comments here to match.
- Where DAML includes important implementation notes tied to schema (e.g., temporary exceptions like
  allowing empty arrays), include a concise note here.

How to update:

- Locate the DAML file for the object/type (e.g., `Fairmint/OpenCapTable/Issuer.daml`,
  `Document.daml`, `Types.daml`).
- Copy the header comment block above the `data ...` definition and paste above the corresponding TS
  interface/type.
- Copy each field comment above its corresponding TS field.
- Preserve ordering guidance where applicable (e.g., id → required → arrays → optional), but do not
  reorder fields in TS if it would be breaking; just carry comments and keep clarity.

Quick references:

- Issuer: `open-captable-protocol-daml/OpenCapTable-v25/daml/Fairmint/OpenCapTable/Issuer.daml`
- Stakeholder & Contact types: `.../Stakeholder.daml`
- Document & ObjectReference/ObjectType: `.../Document.daml`
- StockClass & conversion rights: `.../StockClass.daml` + shared `.../Types.daml`
- StockPlan: `.../StockPlan.daml`
- VestingTerms: `.../VestingTerms.daml`
- Stock/Warrant/Convertible Issuances: respective `.daml` files + shared `Types.daml`
- Shared primitives (Email, Phone, Address, TaxID, Monetary, enums): `.../Types.daml`

Validation:

- After edits, ensure comments match DAML exactly (including terminology) and that links point to
  the canonical OCF `$id` URLs used in DAML.
