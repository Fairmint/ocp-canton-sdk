/**
 * Holds and settlement for integration tests: `CapTable_PlaceHolds`, `CapTable_CancelHolds` and `CapTable_Settle`
 * submitted as the transfer agent through the book's writer, with the contracts they need resolved from its key index.
 *
 * Production places a trade's holds and settles it through the trade desk; these helpers call the anchor's choices
 * directly, as the SDK's builders let tooling do.
 */

import {
  buildCancelHoldsCommand,
  buildPlaceHoldsCommand,
  readCancelHoldsResult,
  readPlaceHoldsResult,
} from '../../../src/functions/OpenCapTable/capTable/holds';
import { buildSettleCommand, readSettleResult } from '../../../src/functions/OpenCapTable/capTable/settle';
import { resolveInputs } from '../../../src/register/inputs';
import { writeScopes } from '../../../src/register/writerScopes';
import type { SubmitAndWaitForTransactionResponse } from '../../../src/types/common';
import type { BookWrite, CancelHoldsResult, DeliveredTerms, PlaceHoldResult } from '../../../src/types/register';
import type { TestBook } from './testBook';

type PlaceHoldsWrite = Extract<BookWrite, { kind: 'placeHolds' }>;
type CancelHoldsWrite = Extract<BookWrite, { kind: 'cancelHolds' }>;
type SettleWrite = Extract<BookWrite, { kind: 'settle' }>;

/** Place one hold per lot under one reference, as the transfer agent. Returns the placed holds, in the lots' order. */
export async function placeHolds(book: TestBook, params: Omit<PlaceHoldsWrite, 'kind'>): Promise<PlaceHoldResult[]> {
  const write: PlaceHoldsWrite = { kind: 'placeHolds', ...params };
  const committed = await book.writer.submit({
    scopes: (index) => writeScopes(index, write),
    build: (index) => {
      const resolved = resolveInputs(index, write);
      return buildPlaceHoldsCommand({
        ...book.writer.capTableAnchor(),
        transferAgent: book.context.transfer_agent,
        inputs: resolved.inputs,
        holdType: write.holdType,
        reference: write.reference,
        date: write.date,
        reasonText: write.reasonText,
        // A settlement hold names its lot's origin issuance, which the index supplies
        lots: write.lots.map((lot) => ({
          ...lot,
          ...(write.holdType === 'REGISTER_SETTLEMENT'
            ? { origin_issuance: lot.origin_issuance ?? resolved.originIssuances.get(lot.security_id) ?? null }
            : {}),
        })),
      });
    },
    decode: (response) => readPlaceHoldsResult(response),
  });
  return committed.result;
}

/** Cancel whole holds, current or voided, as the transfer agent. */
export async function cancelHolds(book: TestBook, params: Omit<CancelHoldsWrite, 'kind'>): Promise<CancelHoldsResult> {
  const write: CancelHoldsWrite = { kind: 'cancelHolds', ...params };
  const committed = await book.writer.submit({
    scopes: (index) => writeScopes(index, write),
    build: (index) =>
      buildCancelHoldsCommand({
        ...book.writer.capTableAnchor(),
        transferAgent: book.context.transfer_agent,
        inputs: resolveInputs(index, write).inputs,
        date: write.date,
        holds: [...write.holds],
      }),
    decode: (response) => readCancelHoldsResult(response),
  });
  return committed.result;
}

/** What a settlement committed: its delivered terms, and the transaction they were read from. */
export interface SettleOutcome {
  terms: DeliveredTerms;
  response: SubmitAndWaitForTransactionResponse;
}

/** Settle a trade, as the transfer agent: draw its lots and cancel the holds it does not draw. */
export async function settle(book: TestBook, params: Omit<SettleWrite, 'kind'>): Promise<SettleOutcome> {
  const write: SettleWrite = { kind: 'settle', ...params };
  let response: SubmitAndWaitForTransactionResponse | undefined;
  const committed = await book.writer.submit({
    scopes: (index) => writeScopes(index, write),
    build: (index) => {
      const resolved = resolveInputs(index, write);
      if (resolved.buyer === null) throw new Error('The settlement resolved no buyer');
      return buildSettleCommand({
        ...book.writer.capTableAnchor(),
        transferAgent: book.context.transfer_agent,
        inputs: resolved.inputs,
        settlementId: write.settlementId,
        date: write.date,
        buyer: resolved.buyer,
        lots: [...write.lots],
      });
    },
    decode: (decoded) => {
      response = decoded;
      return readSettleResult(decoded);
    },
  });
  if (response === undefined) throw new Error('The settlement committed without a response');
  return { terms: committed.result, response };
}
