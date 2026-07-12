import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes } from '../../src/errors';
import type { OcfEntityType } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  decodeLosslessGeneratedDamlValue,
  findLosslessCodecMismatch,
} from '../../src/functions/OpenCapTable/capTable/damlCodecLosslessness';
import {
  convertToOcf,
  decodeDamlEntityData,
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  getEntityAsOcf,
} from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertibleConversionDataToDaml } from '../../src/functions/OpenCapTable/convertibleConversion/convertibleConversionDataToDaml';
import { damlConvertibleConversionToNative } from '../../src/functions/OpenCapTable/convertibleConversion/damlToOcf';
import { getConvertibleConversionAsOcf } from '../../src/functions/OpenCapTable/convertibleConversion/getConvertibleConversionAsOcf';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import {
  damlConvertibleIssuanceDataToNative,
  getConvertibleIssuanceAsOcf,
} from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { issuerDataToDaml } from '../../src/functions/OpenCapTable/issuer/createIssuer';
import { damlIssuerDataToNative, getIssuerAsOcf } from '../../src/functions/OpenCapTable/issuer/getIssuerAsOcf';
import { convertibleMechanismToDaml } from '../../src/functions/OpenCapTable/shared/conversionMechanisms';
import {
  damlStockClassDataToNative,
  getStockClassAsOcf,
} from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { damlStockClassConversionRatioAdjustmentToNative } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/damlToStockClassConversionRatioAdjustment';
import { getStockClassConversionRatioAdjustmentAsOcf } from '../../src/functions/OpenCapTable/stockClassConversionRatioAdjustment/getStockClassConversionRatioAdjustmentAsOcf';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import {
  damlWarrantIssuanceDataToNative,
  getWarrantIssuanceAsOcf,
} from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import { OcpClient } from '../../src/OcpClient';
import { createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

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

const CONVERTIBLE_CONVERSION_DAML = convertibleConversionDataToDaml({
  object_type: 'TX_CONVERTIBLE_CONVERSION',
  id: 'conversion-lossless',
  date: '2026-01-01',
  security_id: 'convertible-security',
  reason_text: 'Conversion',
  trigger_id: 'convertible-trigger',
  resulting_security_ids: ['stock-security'],
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

function mockLedger(entityType: OcfEntityType, data: Record<string, unknown>): LedgerJsonApiClient {
  const ledger = createLedgerJsonApiClient({ network: 'devnet' });
  Object.defineProperty(ledger, 'getEventsByContractId', {
    value: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          templateId: ENTITY_TEMPLATE_ID_MAP[entityType],
          createArgument: {
            context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
            [ENTITY_DATA_FIELD_MAP[entityType]]: data,
          },
        },
      },
    }),
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return ledger;
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
    ['dba false', { dba: false }, 'issuer.dba', OcpErrorCodes.INVALID_TYPE],
    ['dba present undefined', { dba: undefined }, 'issuer.dba', OcpErrorCodes.INVALID_TYPE],
    ['email false', { email: false }, 'issuer.email', OcpErrorCodes.INVALID_TYPE],
    ['email present undefined', { email: undefined }, 'issuer.email', OcpErrorCodes.INVALID_TYPE],
    ['phone false', { phone: false }, 'issuer.phone', OcpErrorCodes.INVALID_TYPE],
    ['address false', { address: false }, 'issuer.address', OcpErrorCodes.INVALID_TYPE],
    ['tax_ids false', { tax_ids: false }, 'issuer.tax_ids', OcpErrorCodes.INVALID_TYPE],
    ['tax_ids null', { tax_ids: null }, 'issuer.tax_ids', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['tax_ids present undefined', { tax_ids: undefined }, 'issuer.tax_ids', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['comments false', { comments: false }, 'issuer.comments', OcpErrorCodes.INVALID_TYPE],
    ['comments null', { comments: null }, 'issuer.comments', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['comments present undefined', { comments: undefined }, 'issuer.comments', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    [
      'initial shares false',
      { initial_shares_authorized: false },
      'issuer.initial_shares_authorized',
      OcpErrorCodes.INVALID_TYPE,
    ],
    [
      'initial shares scalar',
      { initial_shares_authorized: '1' },
      'issuer.initial_shares_authorized',
      OcpErrorCodes.INVALID_TYPE,
    ],
    [
      'initial shares present undefined',
      { initial_shares_authorized: undefined },
      'issuer.initial_shares_authorized',
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
    ],
  ] as const)(
    'rejects malformed present Issuer field %s through direct, public, generic, and OcpClient reads',
    async (_name, patch, fieldPath, code) => {
      const data = { ...ISSUER_DAML, ...patch };
      const expected = {
        name: 'OcpValidationError',
        code,
        fieldPath,
        receivedValue: Object.values(patch)[0],
      };

      expect(captureError(() => damlIssuerDataToNative(data as never))).toMatchObject(expected);
      expect(captureError(() => decodeDamlEntityData('issuer', data as never))).toMatchObject(expected);
      await expect(getIssuerAsOcf(mockLedger('issuer', data), { contractId: 'contract-id' })).rejects.toMatchObject(
        expected
      );

      const ocp = new OcpClient({ ledger: mockLedger('issuer', data) });
      await expect(ocp.OpenCapTable.issuer.get({ contractId: 'contract-id' })).rejects.toMatchObject(expected);
    }
  );

  it('preserves generated null Issuer optionals through every public reader', async () => {
    const data = {
      ...ISSUER_DAML,
      dba: null,
      email: null,
      phone: null,
      address: null,
      initial_shares_authorized: null,
    };

    expect(damlIssuerDataToNative(data)).toMatchObject({ tax_ids: [], comments: [] });
    expect(convertToOcf('issuer', decodeDamlEntityData('issuer', data))).toMatchObject({ tax_ids: [], comments: [] });
    await expect(getIssuerAsOcf(mockLedger('issuer', data), { contractId: 'contract-id' })).resolves.toMatchObject({
      data: { tax_ids: [], comments: [] },
    });
  });

  it('preserves schema-valid empty Issuer strings instead of dropping them as falsy', async () => {
    const data = { ...ISSUER_DAML, dba: '', comments: [''] };
    const expected = { dba: '', comments: [''] };

    expect(damlIssuerDataToNative(data)).toMatchObject(expected);
    expect(convertToOcf('issuer', decodeDamlEntityData('issuer', data))).toMatchObject(expected);
    await expect(getIssuerAsOcf(mockLedger('issuer', data), { contractId: 'contract-id' })).resolves.toMatchObject({
      data: expected,
    });

    const ocp = new OcpClient({ ledger: mockLedger('issuer', data) });
    await expect(ocp.OpenCapTable.issuer.get({ contractId: 'contract-id' })).resolves.toMatchObject({
      data: expected,
    });
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

  it.each([
    ['JavaScript number', 1, OcpErrorCodes.INVALID_TYPE],
    ['eleven fractional digits', '0.00000000001', OcpErrorCodes.INVALID_FORMAT],
    ['twenty-nine integral digits', '1'.repeat(29), OcpErrorCodes.INVALID_FORMAT],
  ] as const)(
    'rejects ConvertibleConversion quantity_converted with %s through direct, generic, and OcpClient reads',
    async (_name, quantityConverted, code) => {
      const data = { ...CONVERTIBLE_CONVERSION_DAML, quantity_converted: quantityConverted };
      const expected = {
        name: 'OcpValidationError',
        code,
        fieldPath: 'convertibleConversion.quantity_converted',
        receivedValue: quantityConverted,
      };

      expect(captureError(() => damlConvertibleConversionToNative(data as never))).toMatchObject(expected);
      expect(captureError(() => decodeDamlEntityData('convertibleConversion', data as never))).toMatchObject(expected);
      await expect(
        getEntityAsOcf(mockLedger('convertibleConversion', data), 'convertibleConversion', 'contract-id')
      ).rejects.toMatchObject(expected);

      const ocp = new OcpClient({ ledger: mockLedger('convertibleConversion', data) });
      await expect(ocp.OpenCapTable.convertibleConversion.get({ contractId: 'contract-id' })).rejects.toMatchObject(
        expected
      );
    }
  );

  it.each([
    ['negative zero', '-0', '0'],
    ['maximum Numeric(10) boundary', `${'9'.repeat(28)}.1234567890`, `${'9'.repeat(28)}.123456789`],
  ] as const)(
    'canonicalizes valid ConvertibleConversion quantity_converted %s through direct, generic, and OcpClient reads',
    async (_name, quantityConverted, expected) => {
      const data = { ...CONVERTIBLE_CONVERSION_DAML, quantity_converted: quantityConverted };

      expect(damlConvertibleConversionToNative(data as never).quantity_converted).toBe(expected);
      await expect(
        getEntityAsOcf(mockLedger('convertibleConversion', data), 'convertibleConversion', 'contract-id')
      ).resolves.toMatchObject({ data: { quantity_converted: expected } });

      const ocp = new OcpClient({ ledger: mockLedger('convertibleConversion', data) });
      await expect(ocp.OpenCapTable.convertibleConversion.get({ contractId: 'contract-id' })).resolves.toMatchObject({
        data: { quantity_converted: expected },
      });
    }
  );
});

describe('lossless direct and dedicated generated DAML readers', () => {
  it.each([
    [
      'outer mechanism variant field',
      (data: MutableConvertibleDaml) => {
        const mechanism = data.conversion_triggers[0].conversion_right.conversion_mechanism as Record<string, unknown>;
        mechanism.future_outer = true;
      },
      'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.future_outer',
    ],
    [
      'inner mechanism record field',
      (data: MutableConvertibleDaml) => {
        data.conversion_triggers[0].conversion_right.conversion_mechanism.value.future_inner = true;
      },
      'convertibleIssuance.conversion_triggers.0.conversion_right.conversion_mechanism.value.future_inner',
    ],
  ] as const)('ConvertibleIssuance rejects a discarded %s', async (_name, mutate, source) => {
    const data = clone(CONVERTIBLE_DAML) as unknown as MutableConvertibleDaml;
    mutate(data);
    const expected = {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source,
    };

    expect(captureError(() => damlConvertibleIssuanceDataToNative(data))).toMatchObject(expected);
    await expect(
      getConvertibleIssuanceAsOcf(mockLedger('convertibleIssuance', data), { contractId: 'contract-id' })
    ).rejects.toMatchObject(expected);
  });

  it.each([
    [
      'outer Issuer field',
      (data: Record<string, unknown>) => {
        data.future_outer = true;
      },
      'issuer.future_outer',
    ],
    [
      'nested email field',
      (data: Record<string, unknown>) => {
        (data.email as Record<string, unknown>).future_inner = true;
      },
      'issuer.email.future_inner',
    ],
    [
      'nested tax-id field',
      (data: Record<string, unknown>) => {
        ((data.tax_ids as Array<Record<string, unknown>>)[0] as Record<string, unknown>).future_inner = true;
      },
      'issuer.tax_ids[0].future_inner',
    ],
  ] as const)('Issuer rejects a discarded %s', async (_name, mutate, source) => {
    const data = issuerDataToDaml({
      object_type: 'ISSUER',
      id: 'issuer-dedicated-lossless',
      legal_name: 'Dedicated Lossless Issuer',
      formation_date: '2026-01-01',
      country_of_formation: 'US',
      email: { email_type: 'BUSINESS', email_address: 'lossless@example.com' },
      tax_ids: [{ country: 'US', tax_id: '12-3456789' }],
    }) as unknown as Record<string, unknown>;
    mutate(data);
    const expected = {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source,
    };

    expect(captureError(() => damlIssuerDataToNative(data as never))).toMatchObject(expected);
    await expect(getIssuerAsOcf(mockLedger('issuer', data), { contractId: 'contract-id' })).rejects.toMatchObject(
      expected
    );
  });

  it('WarrantIssuance rejects a discarded nested warrant mechanism field', async () => {
    const data = clone(WARRANT_DAML) as unknown as MutableWarrantDaml;
    const right = data.exercise_triggers[0].conversion_right.value;
    const mechanism = right.conversion_mechanism as { value: Record<string, unknown> };
    mechanism.value.future_inner = true;
    const expected = {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'warrantIssuance.exercise_triggers.0.conversion_right.value.conversion_mechanism.value.future_inner',
    };

    expect(captureError(() => damlWarrantIssuanceDataToNative(data))).toMatchObject(expected);
    await expect(
      getWarrantIssuanceAsOcf(mockLedger('warrantIssuance', data), { contractId: 'contract-id' })
    ).rejects.toMatchObject(expected);
  });

  it('StockClass rejects a discarded generated conversion-right field', async () => {
    const data = clone(STOCK_CLASS_DAML) as unknown as MutableStockClassDaml;
    data.conversion_rights[0].future = true;
    const expected = {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'stockClass.conversion_rights[0].future',
    };

    expect(captureError(() => damlStockClassDataToNative(data))).toMatchObject(expected);
    await expect(
      getStockClassAsOcf(mockLedger('stockClass', data), { contractId: 'contract-id' })
    ).rejects.toMatchObject(expected);
  });

  it('StockClassConversionRatioAdjustment rejects a discarded generated mechanism field', async () => {
    const data = {
      id: 'ratio-adjustment-lossless',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'stock-class-lossless',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1', currency: 'USD' },
        ratio: { numerator: '2', denominator: '1' },
        rounding_type: 'OcfRoundingNormal' as const,
        future: true,
      },
      comments: [],
    };
    const expected = {
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.future',
    };

    expect(captureError(() => damlStockClassConversionRatioAdjustmentToNative(data))).toMatchObject(expected);
    await expect(
      getStockClassConversionRatioAdjustmentAsOcf(mockLedger('stockClassConversionRatioAdjustment', data), {
        contractId: 'contract-id',
      })
    ).rejects.toMatchObject(expected);
  });

  it.each([
    [
      'missing mechanism',
      {
        id: 'ratio-adjustment',
        date: '2026-01-01T00:00:00.000Z',
        stock_class_id: 'stock-class',
        comments: [],
      },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism',
    ],
    [
      'missing ratio',
      {
        id: 'ratio-adjustment',
        date: '2026-01-01T00:00:00.000Z',
        stock_class_id: 'stock-class',
        new_ratio_conversion_mechanism: {
          conversion_price: { amount: '1', currency: 'USD' },
          rounding_type: 'OcfRoundingNormal',
        },
        comments: [],
      },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio',
    ],
    [
      'boolean numerator',
      {
        id: 'ratio-adjustment',
        date: '2026-01-01T00:00:00.000Z',
        stock_class_id: 'stock-class',
        new_ratio_conversion_mechanism: {
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: false, denominator: '1' },
          rounding_type: 'OcfRoundingNormal',
        },
        comments: [],
      },
      OcpErrorCodes.INVALID_TYPE,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator',
    ],
    [
      'JavaScript-number numerator',
      {
        id: 'ratio-adjustment',
        date: '2026-01-01T00:00:00.000Z',
        stock_class_id: 'stock-class',
        new_ratio_conversion_mechanism: {
          conversion_price: { amount: '1', currency: 'USD' },
          ratio: { numerator: 1, denominator: '1' },
          rounding_type: 'OcfRoundingNormal',
        },
        comments: [],
      },
      OcpErrorCodes.INVALID_TYPE,
      'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator',
    ],
  ] as const)('classifies ratio-adjustment %s before projection', (_name, data, code, fieldPath) => {
    expect(captureError(() => damlStockClassConversionRatioAdjustmentToNative(data as never))).toMatchObject({
      name: 'OcpValidationError',
      code,
      fieldPath,
    });
  });

  it.each([null, undefined])('classifies a nullish ratio-adjustment direct root %p', (value) => {
    expect(captureError(() => damlStockClassConversionRatioAdjustmentToNative(value as never))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'stockClassConversionRatioAdjustment',
      receivedValue: value,
    });
  });

  it('uses the same exact ratio-adjustment numeric diagnostics through the dedicated getter', async () => {
    const data = {
      id: 'ratio-adjustment',
      date: '2026-01-01T00:00:00.000Z',
      stock_class_id: 'stock-class',
      new_ratio_conversion_mechanism: {
        conversion_price: { amount: '1', currency: 'USD' },
        ratio: { numerator: false, denominator: '1' },
        rounding_type: 'OcfRoundingNormal',
      },
      comments: [],
    };
    await expect(
      getStockClassConversionRatioAdjustmentAsOcf(mockLedger('stockClassConversionRatioAdjustment', data), {
        contractId: 'contract-id',
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_TYPE,
      fieldPath: 'stockClassConversionRatioAdjustment.new_ratio_conversion_mechanism.ratio.numerator',
      receivedValue: false,
    });
  });

  it('rejects a missing dedicated ratio-adjustment payload with a structured parse error', async () => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            templateId: ENTITY_TEMPLATE_ID_MAP.stockClassConversionRatioAdjustment,
            createArgument: {
              context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
            },
          },
        },
      }),
    } as unknown as LedgerJsonApiClient;
    await expect(
      getStockClassConversionRatioAdjustmentAsOcf(client, { contractId: 'contract-id' })
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'StockClassConversionRatioAdjustment.createArgument.adjustment_data',
    });
  });

  it.each([null, undefined])('classifies a nullish ConvertibleConversion direct root %p', (value) => {
    expect(captureError(() => damlConvertibleConversionToNative(value as never))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleConversion',
      receivedValue: value,
    });
  });

  it.each([
    ['invalid id', { id: false }, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.id'],
    [
      'missing results',
      { resulting_security_ids: undefined },
      OcpErrorCodes.REQUIRED_FIELD_MISSING,
      'convertibleConversion.resulting_security_ids',
    ],
    ['invalid comments', { comments: false }, OcpErrorCodes.INVALID_TYPE, 'convertibleConversion.comments'],
    [
      'invalid capitalization definition',
      { capitalization_definition: false },
      OcpErrorCodes.INVALID_TYPE,
      'convertibleConversion.capitalization_definition',
    ],
  ] as const)(
    'validates ConvertibleConversion direct and dedicated %s identically',
    async (_name, patch, code, fieldPath) => {
      const data = { ...CONVERTIBLE_CONVERSION_DAML, ...patch };
      const expected = { name: 'OcpValidationError', code, fieldPath };
      expect(captureError(() => damlConvertibleConversionToNative(data as never))).toMatchObject(expected);
      await expect(
        getConvertibleConversionAsOcf(mockLedger('convertibleConversion', data), { contractId: 'contract-id' })
      ).rejects.toMatchObject(expected);
    }
  );

  it('rejects sparse ConvertibleConversion results at their exact index', () => {
    const data = { ...CONVERTIBLE_CONVERSION_DAML, resulting_security_ids: new Array(1) };
    expect(captureError(() => damlConvertibleConversionToNative(data as never))).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleConversion.resulting_security_ids.0',
    });
  });

  it('rejects a discarded nested ConvertibleConversion capitalization field', () => {
    const data = {
      ...CONVERTIBLE_CONVERSION_DAML,
      capitalization_definition: {
        include_stock_class_ids: [],
        include_stock_plans_ids: [],
        include_security_ids: [],
        exclude_security_ids: [],
        future: true,
      },
    };
    expect(captureError(() => damlConvertibleConversionToNative(data as never))).toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'convertibleConversion.capitalization_definition.future',
    });
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

  it('rejects a matching cyclic raw/encoded pair deterministically', () => {
    const raw: Record<string, unknown> = { kept: 1 };
    raw.self = raw;
    const encoded: Record<string, unknown> = { kept: 1 };
    encoded.self = encoded;

    expect(findLosslessCodecMismatch(raw, encoded)).toEqual({
      decoderPath: 'input.self',
      decoderMessage: 'raw graph contains a cyclic reference that cannot be represented by generated DAML JSON',
    });
  });

  it('attributes a cyclic raw graph encoded as a different object to the exact path', () => {
    const raw: Record<string, unknown> = { kept: 1 };
    raw.self = raw;
    const encodedChild: Record<string, unknown> = { kept: 1 };
    encodedChild.self = encodedChild;
    const encoded = { kept: 1, self: encodedChild };

    expect(findLosslessCodecMismatch(raw, encoded)).toEqual({
      decoderPath: 'input.self',
      decoderMessage: 'raw graph contains a cyclic reference that was encoded as a different object',
    });
  });

  it('turns a cyclic generated decode/encode graph into a structured parse error', () => {
    const cyclic: Record<string, unknown> = { kept: 1 };
    cyclic.self = cyclic;
    const codec = {
      decoder: { runWithException: (input: unknown) => input as Record<string, unknown> },
      encode: (value: Record<string, unknown>) => value,
    };

    expect(
      captureError(() =>
        decodeLosslessGeneratedDamlValue(codec, cyclic, { rootPath: 'fixture', description: 'fixture' })
      )
    ).toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'fixture.self',
      context: {
        fieldPath: 'fixture.self',
        decoderPath: 'input.self',
      },
    });
  });

  it('reuses generated decoder results without letting later mutation bypass re-encoding', () => {
    const decoder = jest.fn((input: unknown): Record<string, unknown> => ({ ...(input as Record<string, unknown>) }));
    const encoder = jest.fn((value: Record<string, unknown>): Record<string, unknown> => ({ kept: value.kept }));
    const codec = { decoder: { runWithException: decoder }, encode: encoder };
    const options = { rootPath: 'fixture', description: 'fixture' };

    const decoded = decodeLosslessGeneratedDamlValue(codec, { kept: 1 }, options);
    expect(decodeLosslessGeneratedDamlValue(codec, decoded, options)).toBe(decoded);
    expect(decoder).toHaveBeenCalledTimes(1);
    expect(encoder).toHaveBeenCalledTimes(2);

    decoded.future = true;
    expect(captureError(() => decodeLosslessGeneratedDamlValue(codec, decoded, options))).toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'lossy_daml_decode',
      source: 'fixture.future',
    });
    expect(decoder).toHaveBeenCalledTimes(1);
  });
});

describe('dense rewritten conversion writer collections', () => {
  function expectSparseArrayError(action: () => unknown, fieldPath: string): void {
    expect(captureError(action)).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath,
      receivedValue: undefined,
    });
  }

  const convertibleInput = {
    id: 'convertible-dense',
    date: '2026-01-01',
    security_id: 'convertible-security',
    custom_id: 'SAFE-DENSE',
    stakeholder_id: 'stakeholder-dense',
    investment_amount: { amount: '100', currency: 'USD' },
    convertible_type: 'SAFE' as const,
    conversion_triggers: [
      {
        type: 'ELECTIVE_AT_WILL' as const,
        trigger_id: 'convertible-trigger',
        conversion_right: {
          type: 'CONVERTIBLE_CONVERSION_RIGHT' as const,
          conversion_mechanism: { type: 'SAFE_CONVERSION' as const, conversion_mfn: false },
        },
      },
    ],
    seniority: 1,
    security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
    comments: ['dense'],
  };

  const warrantInput = {
    id: 'warrant-dense',
    date: '2026-01-01',
    security_id: 'warrant-security',
    custom_id: 'W-DENSE',
    stakeholder_id: 'stakeholder-dense',
    purchase_price: { amount: '1', currency: 'USD' },
    exercise_triggers: [
      {
        type: 'ELECTIVE_AT_WILL' as const,
        trigger_id: 'warrant-trigger',
        conversion_right: {
          type: 'WARRANT_CONVERSION_RIGHT' as const,
          conversion_mechanism: { type: 'FIXED_AMOUNT_CONVERSION' as const, converts_to_quantity: '1' },
        },
      },
    ],
    security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
    vestings: [{ date: '2026-02-01', amount: '1' }],
    comments: ['dense'],
  };

  it.each([
    [
      'convertible triggers',
      () => convertibleIssuanceDataToDaml({ ...convertibleInput, conversion_triggers: new Array(1) } as never),
      'convertibleIssuance.conversion_triggers.0',
    ],
    [
      'convertible exemptions',
      () => convertibleIssuanceDataToDaml({ ...convertibleInput, security_law_exemptions: new Array(1) } as never),
      'convertibleIssuance.security_law_exemptions.0',
    ],
    [
      'convertible comments',
      () => convertibleIssuanceDataToDaml({ ...convertibleInput, comments: new Array(1) } as never),
      'convertibleIssuance.comments.0',
    ],
    [
      'warrant triggers',
      () => warrantIssuanceDataToDaml({ ...warrantInput, exercise_triggers: new Array(1) } as never),
      'warrantIssuance.exercise_triggers.0',
    ],
    [
      'warrant exemptions',
      () => warrantIssuanceDataToDaml({ ...warrantInput, security_law_exemptions: new Array(1) } as never),
      'warrantIssuance.security_law_exemptions.0',
    ],
    [
      'warrant vestings',
      () => warrantIssuanceDataToDaml({ ...warrantInput, vestings: new Array(1) } as never),
      'warrantIssuance.vestings.0',
    ],
    [
      'warrant comments',
      () => warrantIssuanceDataToDaml({ ...warrantInput, comments: new Array(1) } as never),
      'warrantIssuance.comments.0',
    ],
    [
      'note interest rates',
      () =>
        convertibleMechanismToDaml({
          type: 'CONVERTIBLE_NOTE_CONVERSION',
          interest_rates: new Array(1),
          day_count_convention: 'ACTUAL_365',
          interest_payout: 'DEFERRED',
          interest_accrual_period: 'MONTHLY',
          compounding_type: 'SIMPLE',
        }),
      'conversion_mechanism.interest_rates.0',
    ],
  ] as const)('rejects a sparse %s collection', (_name, action, fieldPath) => {
    expectSparseArrayError(action, fieldPath);
  });

  it('keeps dense valid arrays unchanged', () => {
    expect(convertibleIssuanceDataToDaml(convertibleInput as never).comments).toEqual(['dense']);
    expect(warrantIssuanceDataToDaml(warrantInput as never).comments).toEqual(['dense']);
  });
});
