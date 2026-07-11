import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { findLosslessCodecMismatch } from '../../src/functions/OpenCapTable/capTable/damlCodecLosslessness';
import {
  decodeDamlEntityData,
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  getEntityAsOcf,
} from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { damlConvertibleIssuanceDataToNative } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { issuerDataToDaml } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { damlIssuerDataToNative } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { damlWarrantIssuanceDataToNative } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { OcpClient } from '../../src/OcpClient';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to throw');
}

const ISSUER_DAML = issuerDataToDaml({
  object_type: 'ISSUER',
  id: 'issuer-lossless',
  legal_name: 'Lossless Issuer',
  formation_date: '2026-01-01',
  country_of_formation: 'US',
  initial_shares_authorized: '1000',
});

const STOCK_CLASS_DAML = stockClassDataToDaml({
  object_type: 'STOCK_CLASS',
  id: 'stock-class-lossless',
  name: 'Common',
  class_type: 'COMMON',
  default_id_prefix: 'CS-',
  initial_shares_authorized: '1000',
  seniority: '1',
  votes_per_share: '1',
  conversion_rights: [
    {
      type: 'STOCK_CLASS_CONVERSION_RIGHT',
      converts_to_stock_class_id: 'stock-class-target',
      conversion_mechanism: {
        type: 'RATIO_CONVERSION',
        ratio: { numerator: '1', denominator: '1' },
        conversion_price: { amount: '1', currency: 'USD' },
        rounding_type: 'NORMAL',
      },
    },
  ],
});

const CONVERTIBLE_DAML = convertibleIssuanceDataToDaml({
  id: 'convertible-lossless',
  date: '2026-01-01',
  security_id: 'convertible-security',
  custom_id: 'SAFE-1',
  stakeholder_id: 'stakeholder-1',
  investment_amount: { amount: '100', currency: 'USD' },
  convertible_type: 'SAFE',
  conversion_triggers: [
    {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'convertible-trigger',
      conversion_right: {
        type: 'CONVERTIBLE_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'SAFE_CONVERSION', conversion_mfn: false },
      },
    },
  ],
  seniority: 1,
  security_law_exemptions: [],
});

const WARRANT_DAML = warrantIssuanceDataToDaml({
  id: 'warrant-lossless',
  date: '2026-01-01',
  security_id: 'warrant-security',
  custom_id: 'W-1',
  stakeholder_id: 'stakeholder-1',
  purchase_price: { amount: '1', currency: 'USD' },
  exercise_triggers: [
    {
      type: 'ELECTIVE_AT_WILL',
      trigger_id: 'warrant-trigger',
      conversion_right: {
        type: 'WARRANT_CONVERSION_RIGHT',
        conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION', converts_to_quantity: '1' },
      },
    },
  ],
  security_law_exemptions: [],
});

interface BoundaryCase {
  readonly entityType: Extract<OcfEntityType, 'issuer' | 'stockClass' | 'convertibleIssuance' | 'warrantIssuance'>;
  readonly data: Record<string, unknown>;
  readonly direct: () => unknown;
  readonly directError: Record<string, unknown>;
  readonly genericError: Record<string, unknown>;
}

type MutableStockClassDaml = Record<string, unknown> & {
  conversion_rights: [Record<string, unknown>, ...Array<Record<string, unknown>>];
};

type MutableConvertibleDaml = Record<string, unknown> & {
  conversion_triggers: [
    {
      conversion_right: Record<string, unknown> & {
        conversion_mechanism: { value: Record<string, unknown> };
      };
    },
    ...Array<{
      conversion_right: Record<string, unknown> & {
        conversion_mechanism: { value: Record<string, unknown> };
      };
    }>,
  ];
};

type MutableWarrantDaml = Record<string, unknown> & {
  exercise_triggers: [
    { conversion_right: { value: Record<string, unknown> } },
    ...Array<{ conversion_right: { value: Record<string, unknown> } }>,
  ];
};

const BOUNDARY_CASES: readonly BoundaryCase[] = [
  {
    entityType: 'issuer',
    data: {
      ...ISSUER_DAML,
      initial_shares_authorized: {
        tag: 'OcfInitialSharesEnum',
        value: 'OcfAuthorizedSharesFuture',
      },
    },
    direct: () =>
      damlIssuerDataToNative({
        ...ISSUER_DAML,
        initial_shares_authorized: {
          tag: 'OcfInitialSharesEnum',
          value: 'OcfAuthorizedSharesFuture',
        },
      } as never),
    directError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      source: 'issuer.initial_shares_authorized.value',
    },
    genericError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      source: 'issuer.initial_shares_authorized.value',
    },
  },
  {
    entityType: 'stockClass',
    data: { ...STOCK_CLASS_DAML, par_value: { amount: false, currency: 'USD' } },
    direct: () => damlStockClassDataToNative({ ...STOCK_CLASS_DAML, par_value: { amount: false, currency: 'USD' } }),
    directError: {
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'stockClass.par_value.amount',
    },
    genericError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'stockClass.par_value',
      classification: 'lossy_daml_decode',
      context: { fieldPath: 'stockClass.par_value' },
    },
  },
  {
    entityType: 'convertibleIssuance',
    data: (() => {
      const data = clone(CONVERTIBLE_DAML) as unknown as MutableConvertibleDaml;
      data.conversion_triggers[0].conversion_right.conversion_mechanism.value.conversion_discount = false;
      return data;
    })(),
    direct: () => {
      const data = clone(CONVERTIBLE_DAML) as unknown as MutableConvertibleDaml;
      data.conversion_triggers[0].conversion_right.conversion_mechanism.value.conversion_discount = false;
      return damlConvertibleIssuanceDataToNative(data);
    },
    directError: {
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.conversion_discount',
    },
    genericError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source:
        'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.value.conversion_discount',
      classification: 'lossy_daml_decode',
      context: {
        fieldPath:
          'convertibleIssuance.conversion_triggers[0].conversion_right.conversion_mechanism.value.conversion_discount',
      },
    },
  },
  {
    entityType: 'warrantIssuance',
    data: { ...WARRANT_DAML, quantity_source: 'OcfQuantityFuture' },
    direct: () => damlWarrantIssuanceDataToNative({ ...WARRANT_DAML, quantity_source: 'OcfQuantityFuture' }),
    directError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
      source: 'warrantIssuance.quantity_source',
    },
    genericError: {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'warrantIssuance.quantity_source',
      classification: 'lossy_daml_decode',
      context: { fieldPath: 'warrantIssuance.quantity_source' },
    },
  },
];

function mockLedger(entityType: BoundaryCase['entityType'], data: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_TEMPLATE_ID_MAP[entityType],
          createArgument: { [ENTITY_DATA_FIELD_MAP[entityType]]: data },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('lossless generic conversion read boundaries', () => {
  it.each(BOUNDARY_CASES)('$entityType direct reader rejects the malformed present value', (testCase) => {
    expect(testCase.direct).toThrow(expect.objectContaining(testCase.directError));
  });

  it.each(BOUNDARY_CASES)(
    '$entityType generic decoder preserves the failure instead of omitting the field',
    (testCase) => {
      expect(captureError(() => decodeDamlEntityData(testCase.entityType, testCase.data as never))).toMatchObject(
        testCase.genericError
      );
    }
  );

  it.each(BOUNDARY_CASES)('$entityType getEntityAsOcf preserves the malformed-field failure', async (testCase) => {
    await expect(
      getEntityAsOcf(mockLedger(testCase.entityType, testCase.data), testCase.entityType, 'contract-id')
    ).rejects.toMatchObject(testCase.genericError);
  });

  it.each(BOUNDARY_CASES)('$entityType OcpClient reader preserves the malformed-field failure', async (testCase) => {
    const ocp = new OcpClient({ ledger: mockLedger(testCase.entityType, testCase.data) });
    const reader = ocp.OpenCapTable[testCase.entityType] as {
      get(params: { contractId: string }): Promise<unknown>;
    };
    await expect(reader.get({ contractId: 'contract-id' })).rejects.toMatchObject(testCase.genericError);
  });

  it.each([
    [
      'StockClass numeric optional',
      'stockClass',
      { ...STOCK_CLASS_DAML, liquidation_preference_multiple: false },
      'stockClass.liquidation_preference_multiple',
    ],
    [
      'StockClass conversion-right optional',
      'stockClass',
      (() => {
        const data = clone(STOCK_CLASS_DAML) as unknown as MutableStockClassDaml;
        data.conversion_rights[0].converts_to_future_round = 'true';
        return data;
      })(),
      'stockClass.conversion_rights[0].converts_to_future_round',
    ],
    [
      'Convertible pro-rata optional',
      'convertibleIssuance',
      { ...CONVERTIBLE_DAML, pro_rata: false },
      'convertibleIssuance.pro_rata',
    ],
    [
      'Convertible conversion-right optional',
      'convertibleIssuance',
      (() => {
        const data = clone(CONVERTIBLE_DAML) as unknown as MutableConvertibleDaml;
        data.conversion_triggers[0].conversion_right.converts_to_future_round = 'true';
        return data;
      })(),
      'convertibleIssuance.conversion_triggers[0].conversion_right.converts_to_future_round',
    ],
    ['Warrant quantity optional', 'warrantIssuance', { ...WARRANT_DAML, quantity: false }, 'warrantIssuance.quantity'],
    [
      'Warrant exercise-price optional',
      'warrantIssuance',
      { ...WARRANT_DAML, exercise_price: { amount: false, currency: 'USD' } },
      'warrantIssuance.exercise_price',
    ],
    [
      'Warrant conversion-right optional',
      'warrantIssuance',
      (() => {
        const data = clone(WARRANT_DAML) as unknown as MutableWarrantDaml;
        data.exercise_triggers[0].conversion_right.value.converts_to_future_round = 'true';
        return data;
      })(),
      'warrantIssuance.exercise_triggers[0].conversion_right.value.converts_to_future_round',
    ],
  ] as const)('rejects a lossy %s at its exact path', (_name, entityType, data, source) => {
    expect(() => decodeDamlEntityData(entityType, data as never)).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification: 'lossy_daml_decode',
        source,
      })
    );
  });

  it('requires the generated tagged initial-shares shape in generic Issuer reads', () => {
    expect(() =>
      decodeDamlEntityData('issuer', {
        ...ISSUER_DAML,
        initial_shares_authorized: { OcfInitialSharesNumeric: '1' },
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'issuer.initial_shares_authorized.tag',
      })
    );
  });

  it.each([
    [
      'missing tag',
      {},
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'issuer.initial_shares_authorized.tag',
      },
    ],
    [
      'present non-string tag',
      { tag: null, value: '1' },
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'issuer.initial_shares_authorized.tag',
      },
    ],
    [
      'missing numeric value',
      { tag: 'OcfInitialSharesNumeric' },
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'issuer.initial_shares_authorized.value',
      },
    ],
    [
      'present non-string numeric value',
      { tag: 'OcfInitialSharesNumeric', value: null },
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'issuer.initial_shares_authorized.value',
      },
    ],
    [
      'unknown string enum value',
      { tag: 'OcfInitialSharesEnum', value: 'OcfAuthorizedSharesFuture' },
      {
        name: 'OcpParseError',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: 'issuer.initial_shares_authorized.value',
      },
    ],
    [
      'unknown string tag',
      { tag: 'OcfInitialSharesFuture', value: '1' },
      {
        name: 'OcpParseError',
        code: OcpErrorCodes.UNKNOWN_ENUM_VALUE,
        source: 'issuer.initial_shares_authorized.tag',
      },
    ],
    [
      'scalar shape',
      '1',
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: 'issuer.initial_shares_authorized',
      },
    ],
    [
      'keyed compatibility shape',
      { OcfInitialSharesNumeric: '1' },
      {
        name: 'OcpValidationError',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
        fieldPath: 'issuer.initial_shares_authorized.tag',
      },
    ],
  ] as const)(
    'retains exact initial-shares diagnostics for a %s through public and generic reads',
    async (_name, initialShares, expected) => {
      const data = { ...ISSUER_DAML, initial_shares_authorized: initialShares };

      expect(captureError(() => damlIssuerDataToNative(data as never))).toMatchObject(expected);
      expect(captureError(() => decodeDamlEntityData('issuer', data as never))).toMatchObject(expected);

      const ocp = new OcpClient({ ledger: mockLedger('issuer', data) });
      await expect(ocp.OpenCapTable.issuer.get({ contractId: 'contract-id' })).rejects.toMatchObject(expected);
    }
  );

  it('retains null as an omitted optional Issuer initial-shares value', async () => {
    const data = { ...ISSUER_DAML, initial_shares_authorized: null };
    expect(damlIssuerDataToNative(data).initial_shares_authorized).toBeUndefined();
    expect(decodeDamlEntityData('issuer', data).initial_shares_authorized).toBeNull();

    const ocp = new OcpClient({ ledger: mockLedger('issuer', data) });
    const result = await ocp.OpenCapTable.issuer.get({ contractId: 'contract-id' });
    expect(result.data.initial_shares_authorized).toBeUndefined();
  });

  it.each([
    [
      'direct generic decoder',
      (data: Record<string, unknown>) => decodeDamlEntityData('convertibleIssuance', data as never),
    ],
    [
      'OcpClient reader',
      async (data: Record<string, unknown>) => {
        const ocp = new OcpClient({ ledger: mockLedger('convertibleIssuance', data) });
        return ocp.OpenCapTable.convertibleIssuance.get({ contractId: 'contract-id' });
      },
    ],
  ] as const)('rejects non-generated DAML Int values through the %s', async (_name, invoke) => {
    for (const [seniority, code] of [
      [1, OcpErrorCodes.INVALID_TYPE],
      ['1.5', OcpErrorCodes.INVALID_FORMAT],
    ] as const) {
      const data = { ...CONVERTIBLE_DAML, seniority };
      const invocation = (async (): Promise<unknown> => invoke(data))();
      await expect(invocation).rejects.toMatchObject({
        name: 'OcpValidationError',
        code,
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      });
    }
  });
});

describe('DAML codec losslessness structure checks', () => {
  it('detects a field discarded by a generated object codec', () => {
    expect(findLosslessCodecMismatch({ kept: 1, discarded: true }, { kept: 1 })).toEqual({
      decoderPath: 'input.discarded',
      decoderMessage: 'raw field was discarded by the generated codec',
    });
  });

  it('detects a sparse raw list before a codec can consume it invisibly', () => {
    expect(findLosslessCodecMismatch(new Array(1), [null])).toEqual({
      decoderPath: 'input[0]',
      decoderMessage: 'raw array element is missing or inherited rather than an own property',
    });
  });

  it('detects inherited enumerable fields and custom prototypes', () => {
    const raw = Object.create({ inherited: true }) as Record<string, unknown>;
    raw.kept = 1;
    expect(findLosslessCodecMismatch(raw, { kept: 1 })).toEqual({
      decoderPath: 'input.inherited',
      decoderMessage: 'raw field is inherited rather than an own property',
    });
  });
});
