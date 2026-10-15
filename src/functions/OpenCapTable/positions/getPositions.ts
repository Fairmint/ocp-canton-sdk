/**
 * Read an issuer's positions (OpenCapTable-v34 0.0.4 `StockPosition` contracts) with their lots, holds and derived
 * quantities.
 *
 * @module getPositions
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { capTableRowContext, loadCapTableRowsAt } from '../capTable/getCapTableState';
import { readCapTablePositionFields } from './capTablePositionFields';
import {
  queryActiveTemplateRows,
  readLedgerEndOffset,
  STOCK_POSITION_TEMPLATE_ID,
  stockPositionStates,
} from './positionLedger';
import type { IssuerPositions } from './positionTypes';

/**
 * Read the issuer's CapTable position fields and, when positions are enabled, every active `StockPosition` of the
 * cap table, all at the current ledger end.
 *
 * Each position carries its lots and holds field for field, plus total, held and free quantities per lot, per
 * restriction bucket (lots with equal `stock_legend_ids` and `security_law_exemptions` sets) and for the position,
 * computed as OCP's `lotHeldQuantity` and `lotFreeQuantity` do: a stopped lot shows nothing free.
 *
 * A CapTable without position fields (OpenCapTable-v34 0.0.3) reads as "no positions", without querying the
 * `StockPosition` template.
 *
 * @param client - Ledger JSON API client with read access for the issuer party
 * @param issuerPartyId - Issuer party ID
 * @returns The positions, or `null` when the issuer has no CapTable on the pinned package line
 * @throws OcpContractError when the issuer has more than one active CapTable
 * @throws OcpParseError when a CapTable position field or a position payload does not match OCP 0.0.4
 */
export async function getPositions(
  client: LedgerJsonApiClient,
  issuerPartyId: string
): Promise<IssuerPositions | null> {
  const offset = await readLedgerEndOffset(client);
  const [row] = await loadCapTableRowsAt(client, issuerPartyId, offset);
  if (row === undefined) return null;

  const capTableContractId = row.createdEvent.contractId;
  const fields = readCapTablePositionFields(row.createdEvent.createArgument, capTableContractId);
  if (!fields.enabled) {
    return { ...fields, capTableContractId, offset, positions: [] };
  }

  const rows = await queryActiveTemplateRows(client, issuerPartyId, STOCK_POSITION_TEMPLATE_ID, offset);
  return { ...fields, capTableContractId, offset, positions: stockPositionStates(rows, capTableRowContext(row)) };
}
