/**
 * Generated → native decoders for the results of the `CapTable` anchor's choices: what `CapTable_Apply` and
 * `CapTable_Restate` created, placed and canceled holds, and a settlement's delivered terms.
 *
 * Internal: every result is decoded through its generated codec first (`decodeGeneratedDaml`), so `DA.Map`, `Optional`
 * and enum encodings stay exact, then mapped to the native types of `types/register`.
 */

import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpParseError } from '../../../errors';
import { contextToNative, damlIntToNumber } from '../../../register/codec';
import { canonicalDecimal } from '../../../register/numeric';
import type { Monetary, SecurityExemption } from '../../../types/native';
import type {
  BookWriteResult,
  CancelHoldsResult,
  DeliveredLot,
  DeliveredTerms,
  PlaceHoldResult,
  RegisterRecordRef,
} from '../../../types/register';
import {
  decodeGeneratedDaml,
  generatedCodec,
  requireGeneratedArray,
  requireGeneratedString,
} from '../../../utils/generatedDamlValidation';
import { ENTITY_REGISTRY } from './batchTypes';
import type { OcfEntityType } from './entityTypes';

type DamlOcfRecordCid = Fairmint.OpenCapTable.OcfRecords.OcfRecordCid;

/** The decoded entries of a generated `DA.Map`, in key order. */
interface DecodedDamlMap<Value> {
  entriesArray(): Array<[string, Value]>;
}

const ENTITY_TYPE_BY_CID_TAG: ReadonlyMap<string, OcfEntityType> = new Map(
  (Object.entries(ENTITY_REGISTRY) as Array<[OcfEntityType, (typeof ENTITY_REGISTRY)[OcfEntityType]]>).map(
    ([entityType, entry]) => [entry.cidTag, entityType]
  )
);

function recordRefToNative(cid: DamlOcfRecordCid, source: string): RegisterRecordRef {
  const entityType = ENTITY_TYPE_BY_CID_TAG.get(cid.tag);
  if (entityType === undefined) {
    throw new OcpParseError(`Unknown OcfRecordCid constructor at ${source}: ${cid.tag}`, {
      source,
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
    });
  }
  return { entityType, contractId: cid.value };
}

function mapToNative<Value, Native>(
  map: DecodedDamlMap<Value>,
  convert: (value: Value, key: string) => Native
): Map<string, Native> {
  return new Map(map.entriesArray().map(([key, value]) => [key, convert(value, key)]));
}

function monetaryToNative(value: Fairmint.OpenCapTable.Types.Monetary.OcfMonetary, source: string): Monetary {
  return { amount: canonicalDecimal(value.amount, `${source}.amount`), currency: value.currency };
}

function exemptionsToNative(exemptions: Fairmint.OpenCapTable.Types.Stock.OcfSecurityExemption[]): SecurityExemption[] {
  return exemptions.map((exemption) => ({ description: exemption.description, jurisdiction: exemption.jurisdiction }));
}

function bookWriteResultToNative(
  result: Fairmint.OpenCapTable.Apply.ApplyResult | Fairmint.OpenCapTable.Restate.RestateResult,
  source: string
): BookWriteResult {
  return {
    records: mapToNative(result.records, (cid, objectId) => recordRefToNative(cid, `${source}.records[${objectId}]`)),
    states: mapToNative(result.states, (cid) => cid),
    epochs: mapToNative(result.epochs, (cid) => cid),
    shards: mapToNative(result.shards, (cid) => cid),
  };
}

/** Decode a `CapTable_Apply` result. */
export function decodeApplyResult(value: unknown, source: string): BookWriteResult {
  return bookWriteResultToNative(
    decodeGeneratedDaml(value, generatedCodec(Fairmint.OpenCapTable.Apply.ApplyResult), source),
    source
  );
}

/** Decode a `CapTable_Restate` result. */
export function decodeRestateResult(value: unknown, source: string): BookWriteResult {
  return bookWriteResultToNative(
    decodeGeneratedDaml(value, generatedCodec(Fairmint.OpenCapTable.Restate.RestateResult), source),
    source
  );
}

/** Decode a `CapTable_PlaceHolds` result: one placed hold per lot, in the lots' order. */
export function decodePlaceHoldResults(value: unknown, source: string): PlaceHoldResult[] {
  return requireGeneratedArray(value, source).map((item, index) => {
    const itemSource = `${source}[${index}]`;
    const result = decodeGeneratedDaml(item, generatedCodec(Fairmint.OpenCapTable.Holds.PlaceHoldResult), itemSource);
    return {
      hold_id: result.hold_id,
      security_id: result.security_id,
      stakeholder_id: result.stakeholder_id,
      stock_class_id: result.stock_class_id,
      split_epoch: damlIntToNumber(result.split_epoch, `${itemSource}.split_epoch`),
      stock_legend_ids: [...result.stock_legend_ids],
      security_law_exemptions: exemptionsToNative(result.security_law_exemptions),
      canceled_settlement_hold:
        result.canceled_settlement_hold === null
          ? null
          : {
              hold_id: result.canceled_settlement_hold.hold_id,
              reference: result.canceled_settlement_hold.reference,
              hold_cancellation_id: result.canceled_settlement_hold.hold_cancellation_id,
            },
      state: result.state,
    };
  });
}

/** Decode a `CapTable_CancelHolds` result. */
export function decodeCancelHoldsResult(value: unknown, source: string): CancelHoldsResult {
  const result = decodeGeneratedDaml(
    value,
    generatedCodec(Fairmint.OpenCapTable.CapTable.CapTable_CancelHoldsResult),
    source
  );
  return {
    canceled: result.canceled.map((canceled) => ({
      security_id: canceled.security_id,
      hold_id: canceled.hold_id,
      hold_cancellation_id: canceled.hold_cancellation_id,
    })),
    states: mapToNative(result.states, (cid) => cid),
  };
}

function deliveredLotToNative(lot: Fairmint.OpenCapTable.Holds.SettleLotResult, source: string): DeliveredLot {
  switch (lot.tag) {
    case 'SettleDrawResult': {
      const draw = lot.value;
      return {
        kind: 'draw',
        security_id: draw.security_id,
        hold_id: draw.hold_id,
        quantity: canonicalDecimal(draw.quantity, `${source}.quantity`),
        share_price: monetaryToNative(draw.share_price, `${source}.share_price`),
        transfer_id: draw.transfer_id,
        buyer_issuance_id: draw.buyer_issuance_id,
        buyer_security_id: draw.buyer_security_id,
        buyer_state: draw.buyer_state,
        balance_issuance_id: draw.balance_issuance_id,
        balance_security_id: draw.balance_security_id,
        balance_state: draw.balance_state,
        stock_legend_ids: [...draw.stock_legend_ids],
        security_law_exemptions: exemptionsToNative(draw.security_law_exemptions),
      };
    }
    case 'SettleCancelResult': {
      const cancel = lot.value;
      return {
        kind: 'cancel',
        security_id: cancel.security_id,
        hold_id: cancel.hold_id,
        hold_cancellation_id: cancel.hold_cancellation_id,
        state: cancel.state,
      };
    }
  }
}

/** Decode a `CapTable_Settle` result (`SettleResult`) as the settlement's delivered terms. */
export function decodeSettleResult(value: unknown, source: string): DeliveredTerms {
  const result = decodeGeneratedDaml(value, generatedCodec(Fairmint.OpenCapTable.Holds.SettleResult), source);
  return {
    context: contextToNative(result.context),
    settlement_id: result.settlement_id,
    seller_stakeholder_id: result.seller_stakeholder_id,
    buyer_stakeholder_id: result.buyer_stakeholder_id,
    stock_class_id: result.stock_class_id,
    lots: result.lots.map((lot, index) => deliveredLotToNative(lot, `${source}.lots[${index}]`)),
    quantity: canonicalDecimal(result.quantity, `${source}.quantity`),
  };
}

/** Decode a choice result that is one contract ID. */
export function decodeContractIdResult(value: unknown, source: string): string {
  const contractId = requireGeneratedString(value, source);
  if (contractId === '') {
    throw new OcpParseError(`Empty contract ID at ${source}`, { source, code: OcpErrorCodes.SCHEMA_MISMATCH });
  }
  return contractId;
}
