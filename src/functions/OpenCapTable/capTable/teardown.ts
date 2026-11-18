/**
 * Teardown of a book being rebuilt: the transfer agent's `CapTable_BeginTeardown` ends every write, then
 * `system_operator` archives the book's contracts with `CapTable_Purge`, at most 500 at a time, and leaves the anchor
 * as a tombstone with `CapTable_Close`.
 */

import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { MAX_CONTRACTS_PER_PURGE } from '../../../register/caps';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type { CapTableCommand, PurgeTarget } from '../../../types/register';
import { requireExerciseResult } from '../shared/exerciseResult';
import {
  anchorCommand,
  requireBoundedList,
  requireDistinct,
  requireText,
  type CapTableAnchorRef,
} from './anchorCommand';
import { purgeTargetToDaml } from './choiceArguments';
import { decodeContractIdResult } from './results';

const BEGIN_TEARDOWN_CHOICE = 'CapTable_BeginTeardown';
const PURGE_CHOICE = 'CapTable_Purge';
const CLOSE_CHOICE = 'CapTable_Close';

/** Parameters of `CapTable_BeginTeardown`. */
export interface BeginTeardownParams extends CapTableAnchorRef {
  /** The transfer agent: the choice's controller */
  transferAgent: string;
}

/** Parameters of `CapTable_Purge`. */
export interface PurgeParams extends CapTableAnchorRef {
  /** `system_operator`: the choice's controller */
  systemOperator: string;
  /** 1 to 500 contracts of the torn-down book, each once */
  targets: PurgeTarget[];
}

/** Parameters of `CapTable_Close`. */
export interface CloseParams extends CapTableAnchorRef {
  /** `system_operator`: the choice's controller */
  systemOperator: string;
}

function readAnchor(
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

/**
 * Build `CapTable_BeginTeardown`, submitted as the transfer agent. It consumes the Active anchor and recreates it
 * tearing down, so every write sequenced after it fails.
 */
export function buildBeginTeardownCommand(params: BeginTeardownParams): CapTableCommand {
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_BeginTeardown = {};
  return anchorCommand(
    params,
    BEGIN_TEARDOWN_CHOICE,
    choiceArgument,
    requireText(params.transferAgent, 'transferAgent')
  );
}

/**
 * The tearing-down anchor `CapTable_BeginTeardown` created, from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no such result
 */
export function readBeginTeardownResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): string {
  return readAnchor(response, BEGIN_TEARDOWN_CHOICE, options);
}

/**
 * Build `CapTable_Purge`, submitted as `system_operator` on the tearing-down anchor. Refused locally as the ledger
 * refuses it: no target or more than 500, and a contract named twice, which the second archive would fail on.
 *
 * @throws OcpValidationError for an argument the ledger would refuse
 */
export function buildPurgeCommand(params: PurgeParams): CapTableCommand {
  const targets = requireBoundedList(
    params.targets,
    'targets',
    {
      empty: 'CapTable_Purge needs at least one contract',
      tooMany: `CapTable_Purge archives at most ${MAX_CONTRACTS_PER_PURGE} contracts`,
    },
    MAX_CONTRACTS_PER_PURGE
  );
  const encoded = targets.map((target, index) => purgeTargetToDaml(target, `targets[${index}]`));
  requireDistinct(
    encoded.map((target) => (target.tag === 'PurgeRecord' ? target.value.value : target.value)),
    'targets',
    'each contract is purged once'
  );
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_Purge = { targets: encoded };
  return anchorCommand(params, PURGE_CHOICE, choiceArgument, requireText(params.systemOperator, 'systemOperator'));
}

/** Build `CapTable_Close`, submitted as `system_operator` on the tearing-down anchor, which it leaves closed. */
export function buildCloseCommand(params: CloseParams): CapTableCommand {
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_Close = {};
  return anchorCommand(params, CLOSE_CHOICE, choiceArgument, requireText(params.systemOperator, 'systemOperator'));
}

/**
 * The closed anchor `CapTable_Close` created, from the submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no such result
 */
export function readCloseResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): string {
  return readAnchor(response, CLOSE_CHOICE, options);
}
