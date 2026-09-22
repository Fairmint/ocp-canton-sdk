/**
 * Tests for the storage-only stock-class conversion sentinel contract.
 *
 * DAML v34 structurally requires `conversion_trigger` on every stock-class conversion
 * right, but never validates or interprets it. The writer stores an inert sentinel and
 * the reader must:
 * - accept the canonical sentinel written by >= 0.8.15 writers,
 * - accept the legacy sentinels written by <= 0.8.14 writers and normalize them to the
 *   same observable output the pre-0.8.15 reader produced,
 * - keep rejecting anything else as a schema mismatch.
 */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import {
  damlStockClassDataToNative,
  getStockClassAsOcf,
} from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassConversionStorageTriggerId } from '../../src/functions/OpenCapTable/stockClass/stockClassConversionStorage';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import type { OcfStockClass } from '../../src/types/native';

/** DAML ledger JSON for a stock class with `rights` conversion rights. */
function ledgerStockClassWithRights(rights: Array<Record<string, unknown>>): {
  conversion_rights: Array<Record<string, unknown>>;
  [key: string]: unknown;
} {
  return {
    id: 'class-001',
    name: 'Common Stock',
    class_type: 'OcfStockClassTypeCommon',
    default_id_prefix: 'CS',
    initial_shares_authorized: { tag: 'OcfInitialSharesNumeric', value: '10000000' },
    seniority: '1',
    votes_per_share: '1',
    comments: [],
    conversion_rights: rights,
    board_approval_date: null,
    liquidation_preference_multiple: null,
    par_value: null,
    participation_cap_multiple: null,
    price_per_share: null,
    stockholder_approval_date: null,
  };
}

/**
 * A legacy sentinel right exactly as written by <= 0.8.14 writers
 * (stockClassDataToDaml buildStockClassTrigger) when the OCF input carried no
 * conversion_trigger: `default-<stockClassId>-<index>` with the right's own
 * STOCK_CLASS_CONVERSION_RIGHT discriminator.
 */
function legacySentinelRightWithoutTrigger(index: number): Record<string, unknown> {
  return {
    type_: 'STOCK_CLASS_CONVERSION_RIGHT',
    conversion_mechanism: 'OcfConversionMechanismRatioConversion',
    conversion_trigger: {
      trigger_id: `default-class-001-${index}`,
      type_: 'OcfTriggerTypeTypeUnspecified',
      conversion_right: {
        tag: 'OcfRightConvertible',
        value: {
          type_: 'STOCK_CLASS_CONVERSION_RIGHT',
          conversion_mechanism: {
            tag: 'OcfConvMechCustom',
            value: { custom_conversion_description: 'Stock class conversion' },
          },
          converts_to_future_round: null,
          converts_to_stock_class_id: 'class-preferred',
        },
      },
      nickname: null,
      trigger_condition: null,
      trigger_date: null,
      trigger_description: null,
    },
    converts_to_stock_class_id: 'class-preferred',
    ratio: { numerator: '3', denominator: '2' },
    percent_of_capitalization: null,
    conversion_price: { amount: '1', currency: 'USD' },
    reference_share_price: null,
    reference_valuation_price_per_share: null,
    discount_rate: null,
    valuation_cap: null,
    floor_price_per_share: null,
    ceiling_price_per_share: null,
    converts_to_future_round: null,
    custom_description: null,
    expires_at: null,
  };
}

/**
 * A legacy sentinel right exactly as written by <= 0.8.14 writers when the OCF input
 * carried a conversion_trigger: `<stockClassId>-trigger-<index>` and the trigger's own
 * type enum (here AUTOMATIC_ON_DATE, mirroring `ELECTIVE...`-style OCF input).
 */
function legacySentinelRightWithTrigger(index: number): Record<string, unknown> {
  const base = legacySentinelRightWithoutTrigger(index);
  const baseTrigger = base.conversion_trigger as Record<string, unknown>;
  return {
    ...base,
    conversion_trigger: {
      ...baseTrigger,
      trigger_id: `class-001-trigger-${index}`,
      type_: 'OcfTriggerTypeTypeAutomaticOnDate',
    },
  };
}

/** The canonical sentinel right as written by >= 0.8.15 canonical writers. */
function canonicalLedgerRight(index: number): Record<string, unknown> {
  const native: OcfStockClass = {
    object_type: 'STOCK_CLASS',
    id: 'class-001',
    name: 'Common Stock',
    class_type: 'COMMON',
    default_id_prefix: 'CS',
    initial_shares_authorized: '10000000',
    seniority: '1',
    votes_per_share: '1',
    conversion_rights: [
      {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '3', denominator: '2' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL',
        },
        converts_to_stock_class_id: 'class-preferred',
      },
    ],
  };
  const daml = stockClassDataToDaml(native);
  return daml.conversion_rights[index];
}

/** Mocks a ledger JSON API client serving a single StockClass contract create argument. */
function mockStockClassClient(ledgerData: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: Fairmint.OpenCapTable.OCF.StockClass.StockClass.templateId,
          createArgument: {
            context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
            stock_class_data: ledgerData,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('stock-class conversion storage sentinel reads', () => {
  describe('canonical writer to reader round trip', () => {
    test('reads 0.8.15-written records back to the canonical OCF shape', () => {
      const ledgerData = ledgerStockClassWithRights([canonicalLedgerRight(0)]);
      const expected: OcfStockClass = {
        object_type: 'STOCK_CLASS',
        id: 'class-001',
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS',
        initial_shares_authorized: '10000000',
        seniority: '1',
        votes_per_share: '1',
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'class-preferred',
          },
        ],
        comments: [],
      };

      expect(damlStockClassDataToNative(ledgerData)).toEqual(expected);
    });

    test('re-decodes 0.8.15-written records with the generated decoder unchanged', () => {
      const ledgerData = ledgerStockClassWithRights([canonicalLedgerRight(0)]);
      const decoded = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.decoder.runWithException(ledgerData);
      const reEncoded = Fairmint.OpenCapTable.OCF.StockClass.StockClassOcfData.encode(decoded);
      expect(reEncoded).toEqual(ledgerData);
    });

    test('uses the documented canonical storage trigger id', () => {
      expect(stockClassConversionStorageTriggerId('class-001', 0)).toBe(
        'ocp-sdk:stock-class:class-001:conversion-right:0:unspecified'
      );
    });
  });

  describe('legacy sentinel normalization', () => {
    test.each([
      { label: 'absent conversion_trigger', ledgerRight: (i: number) => legacySentinelRightWithoutTrigger(i) },
      { label: 'present conversion_trigger', ledgerRight: (i: number) => legacySentinelRightWithTrigger(i) },
    ])('reads the $label legacy sentinel into the pre-0.8.15 reader output', ({ ledgerRight }) => {
      const ledgerData = ledgerStockClassWithRights([ledgerRight(0), ledgerRight(1)]);

      // The observable output of the 0.8.13 reader: the sentinel is ignored and each
      // right is mapped to its own canonical OCF conversion right.
      const expected: OcfStockClass = {
        object_type: 'STOCK_CLASS',
        id: 'class-001',
        name: 'Common Stock',
        class_type: 'COMMON',
        default_id_prefix: 'CS',
        initial_shares_authorized: '10000000',
        seniority: '1',
        votes_per_share: '1',
        conversion_rights: [
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'class-preferred',
          },
          {
            type: 'STOCK_CLASS_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'RATIO_CONVERSION',
              ratio: { numerator: '3', denominator: '2' },
              conversion_price: { amount: '1', currency: 'USD' },
              rounding_type: 'NORMAL',
            },
            converts_to_stock_class_id: 'class-preferred',
          },
        ],
        comments: [],
      };

      expect(damlStockClassDataToNative(ledgerData)).toEqual(expected);
    });

    test('normalizes the legacy sentinel to the canonical storage trigger id on read', () => {
      const ledgerData = ledgerStockClassWithRights([legacySentinelRightWithoutTrigger(0)]);

      expect(damlStockClassDataToNative(ledgerData)).toEqual(
        expect.objectContaining({
          conversion_rights: [
            expect.objectContaining({
              // The legacy `default-...` sentinel must not leak into OCF output; the
              // public model stays free of the storage-only trigger.
              conversion_mechanism: expect.objectContaining({ type: 'RATIO_CONVERSION' }),
            }),
          ],
        })
      );
    });

    test.each([
      {
        name: 'populated trigger field',
        mutate: (right: Record<string, unknown>): Record<string, unknown> => ({
          ...right,
          conversion_trigger: {
            ...(right.conversion_trigger as Record<string, unknown>),
            nickname: 'caller nickname',
          },
        }),
        fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
      },
      {
        name: 'mismatched sentinel target stock class',
        mutate: (right: Record<string, unknown>): Record<string, unknown> => ({
          ...right,
          conversion_trigger: {
            ...(right.conversion_trigger as Record<string, unknown>),
            conversion_right: {
              ...((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>),
              value: {
                ...(((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>)
                  .value as Record<string, unknown>),
                converts_to_stock_class_id: 'class-other',
              },
            },
          },
        }),
        fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
      },
      {
        name: 'non-empty sentinel converts_to_future_round',
        mutate: (right: Record<string, unknown>): Record<string, unknown> => ({
          ...right,
          conversion_trigger: {
            ...(right.conversion_trigger as Record<string, unknown>),
            conversion_right: {
              ...((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>),
              value: {
                ...(((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>)
                  .value as Record<string, unknown>),
                converts_to_future_round: true,
              },
            },
          },
        }),
        fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
      },
      {
        name: 'foreign sentinel description',
        mutate: (right: Record<string, unknown>): Record<string, unknown> => ({
          ...right,
          conversion_trigger: {
            ...(right.conversion_trigger as Record<string, unknown>),
            conversion_right: {
              ...((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>),
              value: {
                ...(((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>)
                  .value as Record<string, unknown>),
                conversion_mechanism: {
                  tag: 'OcfConvMechCustom',
                  value: { custom_conversion_description: 'Caller supplied description' },
                },
              },
            },
          },
        }),
        fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
      },
      {
        name: 'foreign sentinel discriminator',
        mutate: (right: Record<string, unknown>): Record<string, unknown> => ({
          ...right,
          conversion_trigger: {
            ...(right.conversion_trigger as Record<string, unknown>),
            conversion_right: {
              ...((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>),
              value: {
                ...(((right.conversion_trigger as Record<string, unknown>).conversion_right as Record<string, unknown>)
                  .value as Record<string, unknown>),
                type_: 'CONVERTIBLE_CONVERSION_RIGHT',
              },
            },
          },
        }),
        fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
      },
    ])('rejects legacy-shaped data with $name instead of accepting it blindly', ({ mutate, fieldPath }) => {
      const ledgerData = ledgerStockClassWithRights([mutate(legacySentinelRightWithoutTrigger(0))]);

      // The record no longer matches any writer shape, so it must fail validation
      // exactly as malformed ledger data always has.
      expect(() => damlStockClassDataToNative(ledgerData)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath,
        })
      );
    });
  });

  describe('replication read path (getStockClassAsOcf)', () => {
    const expectedRights: OcfStockClass['conversion_rights'] = [
      {
        type: 'STOCK_CLASS_CONVERSION_RIGHT',
        conversion_mechanism: {
          type: 'RATIO_CONVERSION',
          ratio: { numerator: '3', denominator: '2' },
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'NORMAL',
        },
        converts_to_stock_class_id: 'class-preferred',
      },
    ];

    const baseOcfStockClass: OcfStockClass = {
      object_type: 'STOCK_CLASS',
      id: 'class-001',
      name: 'Common Stock',
      class_type: 'COMMON',
      default_id_prefix: 'CS',
      initial_shares_authorized: '10000000',
      seniority: '1',
      votes_per_share: '1',
      comments: [],
      conversion_rights: expectedRights,
    };

    test('reads legacy sentinel records end to end (absent conversion_trigger variant)', async () => {
      const client = mockStockClassClient(ledgerStockClassWithRights([legacySentinelRightWithoutTrigger(0)]));
      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.contractId).toBe('test-contract');
      expect(result.stockClass).toEqual(baseOcfStockClass);
    });

    test('reads legacy sentinel records end to end (present conversion_trigger variant)', async () => {
      const client = mockStockClassClient(ledgerStockClassWithRights([legacySentinelRightWithTrigger(0)]));
      const result = await getStockClassAsOcf(client, { contractId: 'test-contract' });
      expect(result.stockClass).toEqual(baseOcfStockClass);
    });

    test('still rejects malformed sentinels end to end', async () => {
      const ledgerData = ledgerStockClassWithRights([legacySentinelRightWithoutTrigger(0)]);
      const right = ledgerData.conversion_rights[0];
      const rightTrigger = right.conversion_trigger as Record<string, unknown>;
      const tampered = {
        ...ledgerData,
        conversion_rights: [{ ...right, conversion_trigger: { ...rightTrigger, trigger_id: 'caller-data' } }],
      };
      const client = mockStockClassClient(tampered);

      await expect(getStockClassAsOcf(client, { contractId: 'test-contract' })).rejects.toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
        })
      );
    });
  });

  describe('strict rejection of non-sentinel data', () => {
    test('rejects a trigger id that is neither canonical nor legacy', () => {
      const ledgerData = ledgerStockClassWithRights([legacySentinelRightWithoutTrigger(0)]);
      const right = ledgerData.conversion_rights[0];
      const rightTrigger = right.conversion_trigger as Record<string, unknown>;
      const tampered = {
        ...ledgerData,
        conversion_rights: [
          {
            ...right,
            conversion_trigger: { ...rightTrigger, trigger_id: 'legacy-or-caller-supplied-trigger' },
          },
        ],
      };

      expect(() => damlStockClassDataToNative(tampered)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
          receivedValue: 'legacy-or-caller-supplied-trigger',
        })
      );
    });

    test('rejects a legacy-shaped id written for a different index', () => {
      const ledgerData = ledgerStockClassWithRights([legacySentinelRightWithTrigger(1)]);
      const right = ledgerData.conversion_rights[0];
      const rightTrigger = right.conversion_trigger as Record<string, unknown>;
      expect(() => damlStockClassDataToNative(ledgerData)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
          receivedValue: 'class-001-trigger-1',
        })
      );
      expect(rightTrigger.trigger_id).toBe('class-001-trigger-1');
    });

    test('rejects a legacy trigger id paired with a non-sentinel description', () => {
      const ledgerData = ledgerStockClassWithRights([legacySentinelRightWithoutTrigger(0)]);
      const right = ledgerData.conversion_rights[0];
      const rightTrigger = right.conversion_trigger as Record<string, unknown>;
      const sentinelRight = rightTrigger.conversion_right as Record<string, unknown>;
      const sentinelValue = sentinelRight.value as Record<string, unknown>;
      const tampered = {
        ...ledgerData,
        conversion_rights: [
          {
            ...right,
            conversion_trigger: {
              ...rightTrigger,
              conversion_right: {
                ...sentinelRight,
                value: {
                  ...sentinelValue,
                  conversion_mechanism: {
                    tag: 'OcfConvMechCustom',
                    value: { custom_conversion_description: 'Caller supplied description' },
                  },
                },
              },
            },
          },
        ],
      };

      // The legacy classifier only accepts sentinel-shaped pairs, so a legacy trigger
      // id with a foreign description falls into strict validation, which rejects the
      // legacy id first with the canonical expectation.
      expect(() => damlStockClassDataToNative(tampered)).toThrow(
        expect.objectContaining({
          name: 'OcpValidationError',
          code: OcpErrorCodes.SCHEMA_MISMATCH,
          fieldPath: 'stockClass.conversion_rights[0].conversion_trigger.trigger_id',
          receivedValue: 'default-class-001-0',
        })
      );
    });
  });
});
