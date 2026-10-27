/**
 * `CapTable_FreezeClass` and `CapTable_UnfreezeClass`: the brackets of a split's recording. Freezing consumes the
 * class's epoch and recreates it frozen, so writes in flight that fetched it fail and no write that creates or changes
 * a stock state of the class commits until it is unfrozen.
 */

import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type { CapTableCommand } from '../../../types/register';
import { requireExerciseResult } from '../shared/exerciseResult';
import { anchorCommand, requireText, type CapTableAnchorRef } from './anchorCommand';
import { contractIdArgument } from './choiceArguments';
import { decodeContractIdResult } from './results';

const FREEZE_CLASS_CHOICE = 'CapTable_FreezeClass';
const UNFREEZE_CLASS_CHOICE = 'CapTable_UnfreezeClass';

/** Parameters of `CapTable_FreezeClass` and `CapTable_UnfreezeClass`. */
export interface ClassEpochParams extends CapTableAnchorRef {
  /** The transfer agent: the choices' controller */
  transferAgent: string;
  /** The class's active `StockClassEpoch` */
  epochContractId: string;
}

function epochCommand(params: ClassEpochParams, choice: string): CapTableCommand {
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_FreezeClass = {
    epoch: contractIdArgument(params.epochContractId, 'epochContractId'),
  };
  return anchorCommand(params, choice, choiceArgument, requireText(params.transferAgent, 'transferAgent'));
}

function readEpoch(
  response: SubmitAndWaitForTransactionResponse,
  choice: string,
  options: { capTableContractId?: string }
): string {
  return decodeContractIdResult(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${choice}.exerciseResult`
  );
}

/** Build `CapTable_FreezeClass`, submitted as the transfer agent. The ledger refuses a class already frozen. */
export function buildFreezeClassCommand(params: ClassEpochParams): CapTableCommand {
  return epochCommand(params, FREEZE_CLASS_CHOICE);
}

/** Build `CapTable_UnfreezeClass`, submitted as the transfer agent. The ledger refuses a class not frozen. */
export function buildUnfreezeClassCommand(params: ClassEpochParams): CapTableCommand {
  return epochCommand(params, UNFREEZE_CLASS_CHOICE);
}

/**
 * The frozen epoch `CapTable_FreezeClass` created, from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no such result
 */
export function readFreezeClassResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): string {
  return readEpoch(response, FREEZE_CLASS_CHOICE, options);
}

/**
 * The unfrozen epoch `CapTable_UnfreezeClass` created, from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no such result
 */
export function readUnfreezeClassResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): string {
  return readEpoch(response, UNFREEZE_CLASS_CHOICE, options);
}
