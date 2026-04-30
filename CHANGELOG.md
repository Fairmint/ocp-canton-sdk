# Changelog

All notable changes to this project are documented here. Release notes for published versions also
appear on [npm](https://www.npmjs.com/package/@open-captable-protocol/canton).

## [0.4.0] - 2026-04-30

### Breaking

- Removed delegated **CantonPayments**, **PaymentStreams**, and **CouponMinter** APIs from this
  package (previously wired through `OcpClient` / extensions). Those flows are not part of the OCP
  cap-table SDK surface anymore; use the injected **`ledger`** and **`validator`** clients from
  `@fairmint/canton-node-sdk` (or your own integration) if you still need them.

### Unchanged

- **OpenCapTable** / **OpenCapTableReports** / **`context`** and batch
  **`OpenCapTable.capTable.update`** (`UpdateCapTable`) behavior for OCP operations are unchanged by
  this removal.
