/**
 * Builders for `CapTable_PlaceHolds` and `CapTable_CancelHolds`, and their result readers.
 *
 * In production a trade's settlement holds are placed by the trade desk's reserve, which calls `CapTable_PlaceHolds`
 * in its own body; these builders serve stops, releases, tests and tooling.
 */

import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../errors';
import { MAX_HOLD_CANCELLATIONS_PER_TRANSACTION, MAX_LOTS_PER_OPERATION } from '../../../register/caps';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type { HoldType } from '../../../types/native';
import type {
  BookInputs,
  CancelHold,
  CancelHoldsResult,
  CapTableCommand,
  PlaceHoldLot,
  PlaceHoldResult,
} from '../../../types/register';
import { requireExerciseResult } from '../shared/exerciseResult';
import {
  anchorCommand,
  requireBoundedList,
  requireChoiceDate,
  requireDistinct,
  requireText,
  type CapTableAnchorRef,
} from './anchorCommand';
import { bookInputsToDaml, cancelHoldToDaml, holdTypeToDaml, placeHoldLotToDaml } from './choiceArguments';
import { decodeCancelHoldsResult, decodePlaceHoldResults } from './results';

const PLACE_HOLDS_CHOICE = 'CapTable_PlaceHolds';
const CANCEL_HOLDS_CHOICE = 'CapTable_CancelHolds';

/** Parameters of `CapTable_PlaceHolds`: one hold per lot, every lot under one reference. */
export interface PlaceHoldsParams extends CapTableAnchorRef {
  /** The transfer agent: the choice's controller */
  transferAgent: string;
  /** The lots' states and their class's epoch, and the lots' origin issuances for settlement holds */
  inputs: BookInputs;
  holdType: HoldType;
  /** The settlement ID, or the stop's case or order reference; not already open on any lot */
  reference: string;
  /** The ledger date the command is submitted on (`YYYY-MM-DD`) */
  date: string;
  reasonText: string;
  /** 1 to 50 lots, each once; settlement holds go on lots of one stakeholder in one class */
  lots: PlaceHoldLot[];
}

/** Parameters of `CapTable_CancelHolds`. */
export interface CancelHoldsParams extends CapTableAnchorRef {
  /** The transfer agent: the choice's controller */
  transferAgent: string;
  /** The holds' states and their classes' epochs */
  inputs: BookInputs;
  /** The cancellations' date: on or after each lot's last event (`YYYY-MM-DD`) */
  date: string;
  /** 1 to 50 whole holds, current or voided, settlement or stop, each once */
  holds: CancelHold[];
}

function requireHoldType(value: unknown): HoldType {
  if (value !== 'REGISTER_SETTLEMENT' && value !== 'STOP_TRANSFER') {
    throw new OcpValidationError('holdType', 'Unknown hold type', {
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      expectedType: "'REGISTER_SETTLEMENT' | 'STOP_TRANSFER'",
      receivedValue: value,
    });
  }
  return value;
}

/**
 * Build `CapTable_PlaceHolds`, submitted as the transfer agent. Refused locally as the ledger refuses it before it
 * reads a lot: no lot or more than 50, a lot named twice, an empty reference, a settlement lot without its quantity
 * or origin issuance, a stop with a quantity.
 *
 * @throws OcpValidationError for an argument the ledger would refuse
 */
export function buildPlaceHoldsCommand(params: PlaceHoldsParams): CapTableCommand {
  const holdType = requireHoldType(params.holdType);
  const lots = requireBoundedList(
    params.lots,
    'lots',
    {
      empty: 'CapTable_PlaceHolds needs at least one lot',
      tooMany: `CapTable_PlaceHolds takes at most ${MAX_LOTS_PER_OPERATION} lots`,
    },
    MAX_LOTS_PER_OPERATION
  );
  const encodedLots = lots.map((lot, index) => placeHoldLotToDaml(lot, holdType, `lots[${index}]`));
  requireDistinct(
    encodedLots.map((lot) => lot.security_id),
    'lots',
    'each lot appears once'
  );
  if (typeof params.reference !== 'string' || params.reference === '') {
    throw new OcpValidationError('reference', 'a hold needs a reference', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: params.reference,
    });
  }
  if (typeof params.reasonText !== 'string') {
    throw new OcpValidationError('reasonText', 'Expected a string', {
      code: OcpErrorCodes.INVALID_TYPE,
      receivedValue: params.reasonText,
    });
  }
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_PlaceHolds = {
    inputs: bookInputsToDaml(params.inputs),
    hold_type: holdTypeToDaml(holdType, 'holdType'),
    reference: params.reference,
    date: requireChoiceDate(params.date, 'date'),
    reason_text: params.reasonText,
    lots: encodedLots,
  };
  return anchorCommand(params, PLACE_HOLDS_CHOICE, choiceArgument, requireText(params.transferAgent, 'transferAgent'));
}

/**
 * Read the placed holds, one per lot in the lots' order, from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no `CapTable_PlaceHolds` result
 * @throws OcpParseError when the result does not decode
 */
export function readPlaceHoldsResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): PlaceHoldResult[] {
  return decodePlaceHoldResults(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice: PLACE_HOLDS_CHOICE,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${PLACE_HOLDS_CHOICE}.exerciseResult`
  );
}

/**
 * Build `CapTable_CancelHolds`, submitted as the transfer agent. Refused locally as the ledger refuses it: no hold or
 * more than 50, a hold named twice, a cancellation without a reason.
 *
 * @throws OcpValidationError for an argument the ledger would refuse
 */
export function buildCancelHoldsCommand(params: CancelHoldsParams): CapTableCommand {
  const holds = requireBoundedList(
    params.holds,
    'holds',
    {
      empty: 'CapTable_CancelHolds needs at least one hold',
      tooMany: `CapTable_CancelHolds takes at most ${MAX_HOLD_CANCELLATIONS_PER_TRANSACTION} holds`,
    },
    MAX_HOLD_CANCELLATIONS_PER_TRANSACTION
  );
  const encodedHolds = holds.map((hold, index) => cancelHoldToDaml(hold, `holds[${index}]`));
  requireDistinct(
    encodedHolds.map((hold) => hold.hold_id),
    'holds',
    'each hold appears once'
  );
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_CancelHolds = {
    inputs: bookInputsToDaml(params.inputs),
    date: requireChoiceDate(params.date, 'date'),
    holds: encodedHolds,
  };
  return anchorCommand(params, CANCEL_HOLDS_CHOICE, choiceArgument, requireText(params.transferAgent, 'transferAgent'));
}

/**
 * Read the canceled holds and the lots' new states from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no `CapTable_CancelHolds` result
 * @throws OcpParseError when the result does not decode
 */
export function readCancelHoldsResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): CancelHoldsResult {
  return decodeCancelHoldsResult(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice: CANCEL_HOLDS_CHOICE,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${CANCEL_HOLDS_CHOICE}.exerciseResult`
  );
}
