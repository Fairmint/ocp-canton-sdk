/**
 * Curated public API for the OCP Canton SDK.
 *
 * Generated DAML codecs and low-level conversion/read helpers intentionally stay
 * behind this boundary. Public declarations are expressed only in canonical OCF
 * and Canton client types so strict consumers do not inherit code-generator
 * implementation details.
 */

export * from './environment';
export * from './errors';
export * from './observability';
export * from './OcpClient';

export * from './types/branded';
export * from './types/common';
export * from './types/native';
export * from './types/output';
export * from './types/register';
export * from './types/setup';

export * as register from './register';

export * from './functions/OpenCapTable/capTable/entityTypes';

// The CapTable anchor's choices: builders, result readers and the delivered terms of a settlement
export type { CapTableAnchorRef } from './functions/OpenCapTable/capTable/anchorCommand';
export {
  CapTableApply,
  buildApplyCommand,
  readApplyResult,
  type ApplyRecordArguments,
  type BuildApplyCommandParams,
  type CapTableApplyParams,
} from './functions/OpenCapTable/capTable/apply';
export {
  buildFreezeClassCommand,
  buildUnfreezeClassCommand,
  readFreezeClassResult,
  readUnfreezeClassResult,
  type ClassEpochParams,
} from './functions/OpenCapTable/capTable/classFreeze';
export {
  buildCancelHoldsCommand,
  buildPlaceHoldsCommand,
  readCancelHoldsResult,
  readPlaceHoldsResult,
  type CancelHoldsParams,
  type PlaceHoldsParams,
} from './functions/OpenCapTable/capTable/holds';
export {
  CapTableRestate,
  buildRestateCommand,
  readRestateResult,
  type BuildRestateCommandParams,
  type CapTableRestateParams,
  type RestateEditArguments,
} from './functions/OpenCapTable/capTable/restate';
export {
  buildSettleCommand,
  findSettleResults,
  readSettleResult,
  type SettleParams,
} from './functions/OpenCapTable/capTable/settle';
export {
  buildBeginTeardownCommand,
  buildCloseCommand,
  buildPurgeCommand,
  readBeginTeardownResult,
  readCloseResult,
  type BeginTeardownParams,
  type CloseParams,
  type PurgeParams,
} from './functions/OpenCapTable/capTable/teardown';

export type { IssuerDataInput } from './functions/OpenCapTable/issuer/types';
