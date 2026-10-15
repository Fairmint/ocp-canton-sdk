/**
 * Ledger fixtures for OpenCapTable-v34 0.0.4 position registers, in the JSON Ledger API v2 encoding: Decimal and
 * Time as strings, Optional as the value or null, `Map Text a` as `[[key, value], ...]`.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { ENTITY_TEMPLATE_ID_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { STOCK_POSITION_TEMPLATE_ID } from '../../src/functions/OpenCapTable/positions/positionLedger';

export const ISSUER = 'issuer::party';
export const SYSTEM_OPERATOR = 'sysop::party';
export const CONTEXT = { issuer: ISSUER, system_operator: SYSTEM_OPERATOR };
export const OCP_PACKAGE_NAME = OCP_TEMPLATES.capTable.slice(1, OCP_TEMPLATES.capTable.indexOf(':'));
export const OFFSET = 4242;

export const TEMPLATE_IDS = {
  capTable: OCP_TEMPLATES.capTable,
  stockPosition: STOCK_POSITION_TEMPLATE_ID,
  stockIssuance: ENTITY_TEMPLATE_ID_MAP.stockIssuance,
  stockTransfer: ENTITY_TEMPLATE_ID_MAP.stockTransfer,
} as const;

/** `StockIssuanceOcfData` as the ledger encodes it. */
export function damlIssuance(
  securityId: string,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: `ISS-${securityId}`,
    date: '2024-01-01T00:00:00Z',
    security_id: securityId,
    custom_id: `CS-${securityId}`,
    stakeholder_id: 'SH-SELLER',
    board_approval_date: null,
    stockholder_approval_date: null,
    consideration_text: null,
    security_law_exemptions: [],
    stock_class_id: 'CLASS-MANAGED',
    stock_plan_id: null,
    share_numbers_issued: [],
    share_price: { amount: '1.0000000000', currency: 'USD' },
    quantity: '100.0000000000',
    vesting_terms_id: null,
    vestings: [],
    cost_basis: null,
    stock_legend_ids: [],
    issuance_type: null,
    comments: [],
    ...overrides,
  };
}

/** `StockTransferOcfData` as the ledger encodes it. */
export function damlTransfer(
  id: string,
  securityId: string,
  resulting: string[],
  balance: string | null,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id,
    date: '2025-06-01T00:00:00Z',
    quantity: '60.0000000000',
    security_id: securityId,
    comments: [],
    resulting_security_ids: resulting,
    balance_security_id: balance,
    consideration_text: null,
    ...overrides,
  };
}

export interface LotHoldFixture {
  purpose: 'HoldPurposeRegisterSettlement' | 'HoldPurposeStopTransfer' | 'HoldPurposeScripMint';
  reference: string;
  quantity: string | null;
  date?: string;
}

/** `PositionLot` as the ledger encodes it. */
export function damlLot(
  securityId: string,
  options: {
    issuance?: Partial<Record<string, unknown>>;
    holds?: LotHoldFixture[];
    vestingSnapshot?: { vested_quantity: string; as_of: string } | null;
    ancestry?: string[];
  } = {}
): Record<string, unknown> {
  return {
    issuance: damlIssuance(securityId, options.issuance),
    origin_security_id: options.ancestry?.[0] ?? securityId,
    origin_date: '2024-01-01T00:00:00Z',
    ancestry: options.ancestry ?? [],
    holds: (options.holds ?? []).map((hold) => ({ date: '2025-01-01T00:00:00Z', ...hold })),
    vesting_snapshot: options.vestingSnapshot ?? null,
  };
}

/** `StockPosition` create argument. */
export function damlStockPosition(
  lots: Array<Record<string, unknown>>,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    context: CONTEXT,
    stock_class_id: 'CLASS-MANAGED',
    stakeholder_id: 'SH-SELLER',
    holder: 'seller::party',
    lots: lots.map((lot) => [(lot.issuance as { security_id: string }).security_id, lot]),
    ...overrides,
  };
}

/** One `getActiveContracts` row. */
export function activeContract(
  contractId: string,
  templateId: string,
  createArgument: Record<string, unknown>
): Record<string, unknown> {
  return {
    contractEntry: {
      JsActiveContract: {
        createdEvent: {
          contractId,
          templateId,
          packageName: OCP_PACKAGE_NAME,
          createArgument,
          createdEventBlob: '',
          witnessParties: [ISSUER],
          signatories: [ISSUER, SYSTEM_OPERATOR],
          observers: [],
          createdAt: '2025-01-01T00:00:00Z',
          offset: 1,
          nodeId: 0,
          contractKey: null,
          interfaceViews: [],
        },
        synchronizerId: 'sync-1',
        reassignmentCounter: 0,
      },
    },
  };
}

/** A CapTable payload; position fields are added only when given (a 0.0.3 root has none). */
export function capTablePayload(
  options: {
    stockIssuances?: Array<[string, string]>;
    stockIssuancesBySecurityId?: Array<[string, string]>;
    stockTransfers?: Array<[string, string]>;
    stakeholders?: Array<[string, string]>;
    stockClasses?: Array<[string, string]>;
    positionRegistries?: Array<[string, string]> | null;
    migrated?: Array<[string, string]> | null;
    ancestors?: Array<[string, string]> | null;
  } = {}
): Record<string, unknown> {
  return {
    context: CONTEXT,
    issuer: 'issuer-cid',
    stakeholders: options.stakeholders ?? [],
    stock_classes: options.stockClasses ?? [],
    stock_issuances: options.stockIssuances ?? [],
    stock_issuances_by_security_id: options.stockIssuancesBySecurityId ?? [],
    stock_transfers: options.stockTransfers ?? [],
    ...(options.positionRegistries !== undefined ? { position_registries: options.positionRegistries } : {}),
    ...(options.migrated !== undefined ? { position_migrated_security_ids: options.migrated } : {}),
    ...(options.ancestors !== undefined ? { position_ancestor_security_ids: options.ancestors } : {}),
  };
}

export type MockLedgerClient = jest.Mocked<
  Pick<LedgerJsonApiClient, 'getActiveContracts' | 'getEventsByContractId' | 'getLedgerEnd'>
>;

/**
 * A mock ledger client that answers `getActiveContracts` per template ID and `getEventsByContractId` per contract
 * ID. Unknown templates and contracts fail the test.
 *
 * With `contractsVisibleOnlyTo`, the client's own party is not a stakeholder of any contract (a transfer agent's
 * client, say): `getEventsByContractId` finds a contract only when the request's `readAs` names that party, as the
 * Ledger API does.
 */
export function mockLedger(options: {
  activeByTemplate: Partial<Record<string, Array<Record<string, unknown>>>>;
  createArgumentsByContractId?: Record<string, Record<string, unknown>>;
  templateIdsByContractId?: Record<string, string>;
  offset?: number;
  contractsVisibleOnlyTo?: string;
}): MockLedgerClient {
  const client = {
    getLedgerEnd: jest.fn().mockResolvedValue({ offset: options.offset ?? OFFSET }),
    getActiveContracts: jest.fn(async (request: { templateIds?: string[] }) => {
      await Promise.resolve();
      const [templateId] = request.templateIds ?? [];
      const rows = templateId === undefined ? undefined : options.activeByTemplate[templateId];
      if (rows === undefined) {
        throw new Error(`Unexpected getActiveContracts templateIds in test: ${JSON.stringify(request.templateIds)}`);
      }
      return rows as never;
    }),
    getEventsByContractId: jest.fn(async (request: { contractId: string; readAs?: string[] }) => {
      await Promise.resolve();
      const visibleTo = options.contractsVisibleOnlyTo;
      if (visibleTo !== undefined && !(request.readAs ?? []).includes(visibleTo)) {
        throw new Error(`CONTRACT_EVENTS_NOT_FOUND: contract ${request.contractId} is not visible to the read parties`);
      }
      const createArgument = options.createArgumentsByContractId?.[request.contractId];
      if (createArgument === undefined) {
        throw new Error(`Unexpected getEventsByContractId in test: ${request.contractId}`);
      }
      return {
        created: {
          createdEvent: {
            contractId: request.contractId,
            templateId: options.templateIdsByContractId?.[request.contractId],
            packageName: OCP_PACKAGE_NAME,
            createArgument,
          },
        },
      };
    }),
  };
  return client as unknown as MockLedgerClient;
}
