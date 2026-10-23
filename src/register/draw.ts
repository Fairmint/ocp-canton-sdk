/**
 * The settlement arithmetic of one draw, computed off the ledger exactly as `CapTable_Settle` computes and checks it
 * (a port of `drawOne` in `Fairmint.OpenCapTable.Holds`): the IDs the draw derives, the buyer's and the balance's cost
 * bases, the balance's vesting, and the refusals the ledger would abort the settlement with.
 *
 * Source: https://github.com/Fairmint/open-captable-protocol-daml/blob/main/OpenCapTable-v35/daml/Fairmint/OpenCapTable/Holds.daml
 */

import { OcpErrorCodes, type OcpErrorCode } from '../errors/codes';
import { OcpValidationError } from '../errors/OcpValidationError';
import type { Monetary, Vesting } from '../types/native';
import type { DrawLot, PlanDrawInput, PlannedDraw, StockSecurityState } from '../types/register';
import { requireDate } from './dates';
import { deriveId } from './ids';
import { floorMulDiv, fromUnits, mulHalfEven, showDaml, toUnits } from './numeric';
import { applySplits, findHold, isStopped, splitsOnOrBefore } from './splits';
import { drawTranches, fullyCovered, trancheTotal, vestedAt, vestedBy } from './vesting';

function refuse(
  fieldPath: string,
  message: string,
  classification: string,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): never {
  throw new OcpValidationError(fieldPath, message, { code, classification });
}

function requireText(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new OcpValidationError(fieldPath, 'Required field is missing or empty', {
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      expectedType: 'non-empty string',
      receivedValue: value,
    });
  }
  return value;
}

function canonicalMonetary(value: Monetary, fieldPath: string): Monetary {
  return {
    amount: fromUnits(toUnits(value.amount, `${fieldPath}.amount`)),
    currency: requireText(value.currency, `${fieldPath}.currency`),
  };
}

function canonicalTranches(tranches: readonly Vesting[], fieldPath: string): Vesting[] {
  return tranches.map((tranche, index) => ({
    date: requireDate(tranche.date, `${fieldPath}[${index}].date`),
    amount: fromUnits(toUnits(tranche.amount, `${fieldPath}[${index}].amount`)),
  }));
}

// The balance's vesting as the ledger writes it, after checking the caller's tranches where the ledger checks them.
function balanceVestingsOf(
  state: StockSecurityState,
  date: string,
  quantity: bigint,
  remaining: bigint,
  given: readonly Vesting[]
): { lot: Vesting[]; balance: Vesting[] } {
  const hasBalance = remaining > 0n;
  switch (state.vesting.kind) {
    case 'none':
      if (given.length > 0) {
        refuse('balanceVestings', "a fully vested lot's balance carries no vesting", 'balance_vestings');
      }
      return { lot: [], balance: [] };
    case 'tranches':
      if (given.length > 0) {
        refuse('balanceVestings', "a tranche lot's balance vesting is the ledger's to compute", 'balance_vestings');
      }
      return { lot: [], balance: hasBalance ? drawTranches(fromUnits(quantity), state.vesting.tranches) : [] };
    case 'on_terms': {
      const tranches = canonicalTranches(given, 'balanceVestings');
      if (hasBalance) {
        if (toUnits(trancheTotal(tranches)) !== remaining) {
          refuse(
            'balanceVestings',
            `the balance's vestings must sum to its quantity ${showDaml(remaining)}`,
            'balance_vestings',
            OcpErrorCodes.OUT_OF_RANGE
          );
        }
        const keptVested = toUnits(vestedAt(state, date)) - quantity;
        if (toUnits(vestedBy(date, tranches)) !== keptVested) {
          refuse(
            'balanceVestings',
            `the balance's vestings dated on or before the draw must equal the vested ${showDaml(keptVested)} it keeps`,
            'balance_vestings',
            OcpErrorCodes.OUT_OF_RANGE
          );
        }
      } else if (tranches.length > 0) {
        refuse('balanceVestings', 'a full draw has no balance vestings', 'balance_vestings');
      }
      return { lot: tranches, balance: tranches };
    }
  }
}

/**
 * Plan one draw of a settlement: the `DrawLot` to pass to `CapTable_Settle` (or to the trade desk's settle, which
 * calls it) and the delivered terms its result will carry for the lot.
 *
 * As the ledger does, it brings the lot's state to the settlement's date (refusing a date before its last event and
 * applying the class's splits), refuses a stopped lot, a hold that is not open, not a `REGISTER_SETTLEMENT` hold under
 * the settlement or voided by a split, a lot whose tranches cover less than its quantity, a quantity that is not
 * positive or exceeds the hold or the lot, and an origin issuance that is not the lot's; then it derives the transfer,
 * buyer issuance, buyer security, balance issuance and balance security IDs from the state's `seq`. The buyer's cost
 * basis is the share price times the quantity, rounded half-even at scale 10, in the share price's currency; the
 * balance keeps the origin's cost basis times remaining / quantity, floored, or none. A fully vested or tranche lot's
 * balance vesting is the ledger's to compute (`balance_vestings` empty); a lot on vesting terms needs the caller's
 * tranches, which must sum to the balance and vest by the date exactly the vested shares it keeps.
 *
 * The ledger also requires the date to be its own and the class not to be frozen; neither is known here.
 *
 * @throws OcpValidationError with the ledger's message (and a `classification`: `event_before_last_event`,
 * `split_application`, `stopped_lot`, `hold_not_open`, `not_settlement_hold`, `voided_hold`, `partial_tranche_cover`,
 * `draw_quantity`, `origin_mismatch`, `balance_vestings`) when the ledger would refuse the draw, or for malformed input
 */
export function planDraw(input: PlanDrawInput): PlannedDraw {
  const date = requireDate(input.date, 'date');
  const capTableId = requireText(input.capTableId, 'capTableId');
  const settlementId = requireText(input.settlementId, 'settlementId');
  const holdId = requireText(input.holdId, 'holdId');
  const customId = requireText(input.customId, 'customId');
  const originContractId = requireText(input.originIssuance.contractId, 'originIssuance.contractId');
  const origin = input.originIssuance.data;
  const sharePrice = canonicalMonetary(input.sharePrice, 'sharePrice');
  const quantity = toUnits(input.quantity, 'quantity');
  const securityId = input.state.security_id;

  if (date < input.state.last_event_date) {
    refuse(
      'date',
      `event dated ${date} precedes the last event on security ${securityId} (${input.state.last_event_date})`,
      'event_before_last_event'
    );
  }
  const applied = applySplits(input.epochSplits, date, input.state);
  if (!applied.ok) refuse('state', applied.message, 'split_application');
  const state = applied.value;
  if (isStopped(state)) refuse('state', `security ${securityId} is stopped`, 'stopped_lot');
  const hold = findHold(holdId, state);
  if (hold === null) refuse('holdId', `hold ${holdId} is not open on security ${securityId}`, 'hold_not_open');
  if (hold.hold_type !== 'REGISTER_SETTLEMENT' || hold.reference !== settlementId) {
    refuse('holdId', `hold ${holdId} is not a settlement hold under ${settlementId}`, 'not_settlement_hold');
  }
  if (hold.split_epoch !== splitsOnOrBefore(input.epochSplits, date)) {
    refuse('holdId', `a split of the class voided hold ${holdId}`, 'voided_hold');
  }
  if (!fullyCovered(state)) {
    refuse('state', `security ${securityId} has tranches covering less than its quantity`, 'partial_tranche_cover');
  }
  const lotQuantity = toUnits(state.quantity, 'state.quantity');
  const holdQuantity = hold.quantity === null ? null : toUnits(hold.quantity, 'hold.quantity');
  if (!(quantity > 0n && holdQuantity !== null && quantity <= holdQuantity && quantity <= lotQuantity)) {
    refuse(
      'quantity',
      `draw of ${showDaml(quantity)} must be positive and at most hold ${holdId}'s quantity`,
      'draw_quantity',
      OcpErrorCodes.OUT_OF_RANGE
    );
  }
  if (origin.id !== state.origin_transaction_id) {
    refuse('originIssuance', `issuance ${origin.id} is not the origin of security ${securityId}`, 'origin_mismatch');
  }
  if (
    origin.security_id !== state.security_id ||
    origin.stakeholder_id !== state.stakeholder_id ||
    origin.stock_class_id !== state.stock_class_id
  ) {
    refuse(
      'originIssuance',
      `origin issuance ${origin.id} disagrees with security ${securityId}'s stakeholder or class`,
      'origin_mismatch'
    );
  }

  const derive = (
    role: 'event' | 'resulting_issuance' | 'resulting_security' | 'balance_issuance' | 'balance_security'
  ) => deriveId({ capTableId, securityId, seq: state.seq, role, index: 0 });
  const remaining = lotQuantity - quantity;
  const hasBalance = remaining > 0n;
  const drawn = fromUnits(quantity);
  const buyerCostBasis: Monetary = { amount: mulHalfEven(sharePrice.amount, drawn), currency: sharePrice.currency };
  const originBasis =
    origin.cost_basis === undefined ? null : canonicalMonetary(origin.cost_basis, 'originIssuance.data.cost_basis');
  const balanceCostBasis: Monetary | null =
    hasBalance && originBasis !== null
      ? {
          amount: floorMulDiv(originBasis.amount, fromUnits(remaining), state.quantity),
          currency: originBasis.currency,
        }
      : null;
  const vestings = balanceVestingsOf(state, date, quantity, remaining, input.balanceVestings ?? []);

  const lot: DrawLot = {
    security_id: securityId,
    hold_id: holdId,
    quantity: drawn,
    custom_id: customId,
    share_price: sharePrice,
    buyer_cost_basis: buyerCostBasis,
    balance_cost_basis: balanceCostBasis,
    balance_vestings: vestings.lot,
    origin_issuance: originContractId,
  };
  return {
    lot,
    delivered: {
      kind: 'draw',
      security_id: securityId,
      hold_id: holdId,
      quantity: drawn,
      share_price: sharePrice,
      transfer_id: derive('event'),
      buyer_issuance_id: derive('resulting_issuance'),
      buyer_security_id: derive('resulting_security'),
      balance_issuance_id: hasBalance ? derive('balance_issuance') : null,
      balance_security_id: hasBalance ? derive('balance_security') : null,
      stock_legend_ids: [...origin.stock_legend_ids],
      security_law_exemptions: origin.security_law_exemptions.map((exemption) => ({
        description: exemption.description,
        jurisdiction: exemption.jurisdiction,
      })),
    },
    seller_stakeholder_id: state.stakeholder_id,
    stock_class_id: state.stock_class_id,
    balance: hasBalance
      ? { quantity: fromUnits(remaining), cost_basis: balanceCostBasis, vestings: vestings.balance }
      : null,
  };
}
