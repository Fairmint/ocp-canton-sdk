/**
 * `CapTable_Settle`: the builder (for tests and tooling; production settles through the trade desk's
 * `TradeDesk_Settle`, which calls it beside the cash leg) and the delivered terms its `SettleResult` carries.
 *
 * There is no delivery proof: the settling transaction's `CapTable_Settle` result is the record of what was delivered,
 * and `findSettleResults` reads it from any ledger-effects transaction, nested under a desk choice or not.
 */

import { OCP_TEMPLATES, type Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpContractError, OcpErrorCodes, OcpParseError, OcpValidationError } from '../../../errors';
import { MAX_LOTS_PER_OPERATION } from '../../../register/caps';
import { moduleEntityOf, OPEN_CAP_TABLE_PACKAGE_NAME, packageRefOf } from '../../../register/templates';
import type { SubmitAndWaitForTransactionResponse } from '../../../types/common';
import type {
  BookInputs,
  CapTableCommand,
  DeliveredTerms,
  LedgerEffectsTransaction,
  SettleBuyer,
  SettleLot,
  SettlementInTransaction,
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
import { bookInputsToDaml, settleBuyerToDaml, settleLotToDaml } from './choiceArguments';
import { decodeSettleResult } from './results';

const SETTLE_CHOICE = 'CapTable_Settle';
const CAP_TABLE_MODULE_ENTITY = moduleEntityOf(OCP_TEMPLATES.capTable);

/** Parameters of `CapTable_Settle`. */
export interface SettleParams extends CapTableAnchorRef {
  /** The transfer agent: the choice's controller */
  transferAgent: string;
  /** The lots' states, their class's epoch, the origin issuances, the buyer's stakeholder and the shard a new one claims */
  inputs: BookInputs;
  /** The settlement ID: the reference of every hold the trade placed */
  settlementId: string;
  /** The ledger date the command is submitted on (`YYYY-MM-DD`) */
  date: string;
  buyer: SettleBuyer;
  /** Every hold of the trade, drawn or canceled: 1 to 50 lots, each once, at least one drawn */
  lots: SettleLot[];
}

/**
 * Build `CapTable_Settle`, submitted as the transfer agent. Refused locally as the ledger refuses it before it reads a
 * lot: an empty settlement ID, no lot or more than 50, a lot named twice, no draw, a cancellation without a reason.
 *
 * @throws OcpValidationError for an argument the ledger would refuse
 */
export function buildSettleCommand(params: SettleParams): CapTableCommand {
  if (typeof params.settlementId !== 'string' || params.settlementId === '') {
    throw new OcpValidationError('settlementId', 'a settlement needs its reference', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      receivedValue: params.settlementId,
    });
  }
  const lots = requireBoundedList(
    params.lots,
    'lots',
    {
      empty: 'CapTable_Settle needs at least one lot',
      tooMany: `CapTable_Settle takes at most ${MAX_LOTS_PER_OPERATION} lots`,
    },
    MAX_LOTS_PER_OPERATION
  );
  const encodedLots = lots.map((lot, index) => settleLotToDaml(lot, `lots[${index}]`));
  requireDistinct(
    encodedLots.map((lot) => lot.value.security_id),
    'lots',
    'each lot appears once'
  );
  if (!encodedLots.some((lot) => lot.tag === 'SettleDraw')) {
    throw new OcpValidationError(
      'lots',
      'a settlement draws at least one lot; release a trade with CapTable_CancelHolds',
      { code: OcpErrorCodes.INVALID_FORMAT }
    );
  }
  const choiceArgument: Fairmint.OpenCapTable.CapTable.CapTable_Settle = {
    inputs: bookInputsToDaml(params.inputs),
    settlement_id: params.settlementId,
    date: requireChoiceDate(params.date, 'date'),
    buyer: settleBuyerToDaml(params.buyer, 'buyer'),
    lots: encodedLots,
  };
  return anchorCommand(params, SETTLE_CHOICE, choiceArgument, requireText(params.transferAgent, 'transferAgent'));
}

/**
 * Read the delivered terms from the settling submission's ledger-effects transaction.
 *
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when the transaction carries no `CapTable_Settle` result
 * @throws OcpParseError when the result does not decode
 */
export function readSettleResult(
  response: SubmitAndWaitForTransactionResponse,
  options: { capTableContractId?: string } = {}
): DeliveredTerms {
  return decodeSettleResult(
    requireExerciseResult(response, {
      templateId: OCP_TEMPLATES.capTable,
      choice: SETTLE_CHOICE,
      ...(options.capTableContractId !== undefined ? { contractId: options.capTableContractId } : {}),
    }),
    `${SETTLE_CHOICE}.exerciseResult`
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The package an exercised event's template belongs to, by name: the event's own, else a package-name template ID's.
function packageNameOf(event: Record<string, unknown>, templateId: string): string | null {
  if (typeof event.packageName === 'string') return event.packageName;
  const packageRef = packageRefOf(templateId);
  return packageRef.startsWith('#') ? packageRef.slice(1) : null;
}

/**
 * Every `CapTable_Settle` exercised on an OpenCapTable-v35 anchor in a ledger-effects transaction, in event order,
 * with its delivered terms: one the TA submitted directly, or one nested under the trade desk's `TradeDesk_Settle`.
 * Events of any other package, even one with the same module and choice names, are left out.
 *
 * @param transaction - the transaction as read in the ledger-effects shape, which keeps exercised events and their
 * results (`SubmitAndWaitForTransactionResponse['transaction']` is one)
 * @throws OcpContractError (`RESULT_NOT_FOUND`) when a matching event carries no result, as a transaction read in
 * another shape would
 * @throws OcpParseError when a result does not decode, or its acting parties are not the transfer agent it names
 */
export function findSettleResults(transaction: LedgerEffectsTransaction): SettlementInTransaction[] {
  const events: unknown = isRecord(transaction) ? transaction.events : undefined;
  if (!Array.isArray(events)) {
    throw new OcpParseError('Expected a transaction with events', {
      source: 'transaction.events',
      code: OcpErrorCodes.INVALID_RESPONSE,
    });
  }
  const found: SettlementInTransaction[] = [];
  for (const [index, event] of (events as unknown[]).entries()) {
    if (!isRecord(event) || !isRecord(event.ExercisedEvent)) continue;
    const exercised = event.ExercisedEvent;
    const { templateId, contractId } = exercised;
    if (exercised.choice !== SETTLE_CHOICE || typeof templateId !== 'string' || typeof contractId !== 'string') {
      continue;
    }
    if (moduleEntityOf(templateId) !== CAP_TABLE_MODULE_ENTITY) continue;
    if (packageNameOf(exercised, templateId) !== OPEN_CAP_TABLE_PACKAGE_NAME) continue;
    if (typeof exercised.interfaceId === 'string' && exercised.interfaceId !== '') continue;
    const source = `transaction.events[${index}].ExercisedEvent.exerciseResult`;
    if (exercised.exerciseResult === undefined || exercised.exerciseResult === null) {
      throw new OcpContractError(`${SETTLE_CHOICE} result not found in transaction`, {
        contractId,
        templateId,
        choice: SETTLE_CHOICE,
        code: OcpErrorCodes.RESULT_NOT_FOUND,
        classification: 'missing_exercise_result',
      });
    }
    const terms = decodeSettleResult(exercised.exerciseResult, source);
    const { actingParties } = exercised;
    if (
      Array.isArray(actingParties) &&
      (actingParties.length !== 1 || actingParties[0] !== terms.context.transfer_agent)
    ) {
      throw new OcpParseError(`${SETTLE_CHOICE} was not exercised by the transfer agent its result names`, {
        source: `transaction.events[${index}].ExercisedEvent.actingParties`,
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'settlement_acting_parties',
        context: { actingParties, transferAgent: terms.context.transfer_agent },
      });
    }
    found.push({
      capTableContractId: contractId,
      templateId,
      nodeId: typeof exercised.nodeId === 'number' ? exercised.nodeId : null,
      terms,
    });
  }
  return found;
}
