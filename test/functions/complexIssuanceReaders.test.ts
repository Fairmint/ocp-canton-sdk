/** Direct ledger-reader contracts for the complex issuance transaction families. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertibleIssuanceDataToDaml } from '../../src/functions/OpenCapTable/convertibleIssuance/createConvertibleIssuance';
import { getConvertibleIssuanceAsOcf } from '../../src/functions/OpenCapTable/convertibleIssuance/getConvertibleIssuanceAsOcf';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import { getEquityCompensationIssuanceAsOcf } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { warrantIssuanceDataToDaml } from '../../src/functions/OpenCapTable/warrantIssuance/createWarrantIssuance';
import { getWarrantIssuanceAsOcf } from '../../src/functions/OpenCapTable/warrantIssuance/getWarrantIssuanceAsOcf';
import type { OcfConvertibleIssuance, OcfEquityCompensationIssuance, OcfWarrantIssuance } from '../../src/types/native';

type ComplexIssuanceEntityType = Extract<
  OcfEntityType,
  'convertibleIssuance' | 'equityCompensationIssuance' | 'warrantIssuance'
>;
type ComplexIssuance = OcfConvertibleIssuance | OcfEquityCompensationIssuance | OcfWarrantIssuance;

function convertibleData(): Record<string, unknown> {
  return {
    ...convertibleIssuanceDataToDaml({
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-issuance-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      custom_id: 'CONV-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Cash investment',
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
      investment_amount: { amount: '1000.00', currency: 'USD' },
      convertible_type: 'SAFE',
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'convertible-trigger-1',
          nickname: 'Holder election',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Convert on mutually agreed terms',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      pro_rata: '0.10',
      seniority: 2,
      comments: ['convertible issued'],
    }),
  };
}

function equityCompensationData(variant: 'OPTION' | 'SAR' | 'RSU' = 'OPTION'): Record<string, unknown> {
  const common = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
    id: `equity-compensation-${variant.toLowerCase()}-1`,
    date: '2026-07-10',
    security_id: `equity-compensation-${variant.toLowerCase()}-security-1`,
    custom_id: `EQUITY-${variant}-1`,
    stakeholder_id: 'stakeholder-1',
    stock_plan_id: 'stock-plan-1',
    stock_class_id: 'stock-class-1',
    board_approval_date: '2026-07-09',
    stockholder_approval_date: '2026-07-08',
    consideration_text: 'Services',
    vesting_terms_id: 'vesting-terms-1',
    quantity: '100.00',
    early_exercisable: false,
    security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
    vestings: [{ date: '2027-07-10', amount: '25.00' }] as [{ date: string; amount: string }],
    expiration_date: '2036-07-10',
    termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER' as const, period: 90, period_type: 'DAYS' as const }],
    comments: ['equity compensation issued'],
  };

  switch (variant) {
    case 'OPTION':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'OPTION_ISO',
        exercise_price: { amount: '2.50', currency: 'USD' },
      });
    case 'SAR':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'CSAR',
        base_price: { amount: '3.50', currency: 'USD' },
      });
    case 'RSU':
      return equityCompensationIssuanceDataToDaml({
        ...common,
        compensation_type: 'RSU',
      });
  }
}

function warrantData(): Record<string, unknown> {
  return {
    ...warrantIssuanceDataToDaml({
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      custom_id: 'WARRANT-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Commercial agreement',
      security_law_exemptions: [{ description: 'Section 4(a)(2)', jurisdiction: 'US' }],
      quantity: '50.00',
      quantity_source: 'INSTRUMENT_FIXED',
      exercise_price: { amount: '5.00', currency: 'USD' },
      purchase_price: { amount: '25.00', currency: 'USD' },
      exercise_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'warrant-trigger-1',
          nickname: 'Holder exercise',
          conversion_right: {
            type: 'WARRANT_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Exercise under the warrant agreement',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      warrant_expiration_date: '2031-07-10',
      vesting_terms_id: 'vesting-terms-1',
      vestings: [{ date: '2027-07-10', amount: '10.00' }],
      comments: ['warrant issued'],
    }),
  };
}

interface ComplexIssuanceReaderCase {
  readonly entityType: ComplexIssuanceEntityType;
  readonly contractId: string;
  readonly validData: () => Record<string, unknown>;
  readonly malformedNumericData: () => Record<string, unknown>;
  readonly semanticallyInvalidNumericData: () => Record<string, unknown>;
  readonly expectedEvent: ComplexIssuance;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: ComplexIssuance; readonly contractId: string }>;
}

const issuanceReaderCases: readonly ComplexIssuanceReaderCase[] = [
  {
    entityType: 'convertibleIssuance',
    contractId: 'convertible-issuance-cid',
    validData: convertibleData,
    malformedNumericData: () => ({
      ...convertibleData(),
      investment_amount: { amount: 17, currency: 'USD' },
    }),
    semanticallyInvalidNumericData: () => ({
      ...convertibleData(),
      investment_amount: { amount: '1e3', currency: 'USD' },
    }),
    expectedEvent: {
      object_type: 'TX_CONVERTIBLE_ISSUANCE',
      id: 'convertible-issuance-1',
      date: '2026-07-10',
      security_id: 'convertible-security-1',
      custom_id: 'CONV-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Cash investment',
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 'US' }],
      investment_amount: { amount: '1000', currency: 'USD' },
      convertible_type: 'SAFE',
      conversion_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'convertible-trigger-1',
          nickname: 'Holder election',
          conversion_right: {
            type: 'CONVERTIBLE_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Convert on mutually agreed terms',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      pro_rata: '0.1',
      seniority: 2,
      comments: ['convertible issued'],
    },
    invoke: async (client, readAs) =>
      getConvertibleIssuanceAsOcf(client, {
        contractId: 'convertible-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'equityCompensationIssuance',
    contractId: 'equity-compensation-issuance-cid',
    validData: equityCompensationData,
    malformedNumericData: () => ({ ...equityCompensationData(), quantity: 17 }),
    semanticallyInvalidNumericData: () => ({ ...equityCompensationData(), quantity: '1e3' }),
    expectedEvent: {
      object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
      id: 'equity-compensation-option-1',
      date: '2026-07-10',
      security_id: 'equity-compensation-option-security-1',
      custom_id: 'EQUITY-OPTION-1',
      stakeholder_id: 'stakeholder-1',
      compensation_type: 'OPTION_ISO',
      exercise_price: { amount: '2.5', currency: 'USD' },
      quantity: '100',
      expiration_date: '2036-07-10',
      termination_exercise_windows: [{ reason: 'VOLUNTARY_OTHER', period: 90, period_type: 'DAYS' }],
      early_exercisable: false,
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Services',
      vesting_terms_id: 'vesting-terms-1',
      stock_class_id: 'stock-class-1',
      stock_plan_id: 'stock-plan-1',
      security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }],
      vestings: [{ date: '2027-07-10', amount: '25' }],
      comments: ['equity compensation issued'],
    },
    invoke: async (client, readAs) =>
      getEquityCompensationIssuanceAsOcf(client, {
        contractId: 'equity-compensation-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      }),
  },
  {
    entityType: 'warrantIssuance',
    contractId: 'warrant-issuance-cid',
    validData: warrantData,
    malformedNumericData: () => ({
      ...warrantData(),
      purchase_price: { amount: 17, currency: 'USD' },
    }),
    semanticallyInvalidNumericData: () => ({
      ...warrantData(),
      purchase_price: { amount: '1e3', currency: 'USD' },
    }),
    expectedEvent: {
      object_type: 'TX_WARRANT_ISSUANCE',
      id: 'warrant-issuance-1',
      date: '2026-07-10',
      security_id: 'warrant-security-1',
      custom_id: 'WARRANT-1',
      stakeholder_id: 'stakeholder-1',
      board_approval_date: '2026-07-09',
      stockholder_approval_date: '2026-07-08',
      consideration_text: 'Commercial agreement',
      security_law_exemptions: [{ description: 'Section 4(a)(2)', jurisdiction: 'US' }],
      quantity: '50',
      quantity_source: 'INSTRUMENT_FIXED',
      exercise_price: { amount: '5', currency: 'USD' },
      purchase_price: { amount: '25', currency: 'USD' },
      exercise_triggers: [
        {
          type: 'ELECTIVE_AT_WILL',
          trigger_id: 'warrant-trigger-1',
          nickname: 'Holder exercise',
          conversion_right: {
            type: 'WARRANT_CONVERSION_RIGHT',
            conversion_mechanism: {
              type: 'CUSTOM_CONVERSION',
              custom_conversion_description: 'Exercise under the warrant agreement',
            },
            converts_to_future_round: false,
            converts_to_stock_class_id: 'stock-class-1',
          },
        },
      ],
      warrant_expiration_date: '2031-07-10',
      vesting_terms_id: 'vesting-terms-1',
      vestings: [{ date: '2027-07-10', amount: '10' }],
      comments: ['warrant issued'],
    },
    invoke: async (client, readAs) => {
      const result = await getWarrantIssuanceAsOcf(client, {
        contractId: 'warrant-issuance-cid',
        ...(readAs !== undefined ? { readAs } : {}),
      });
      return { event: result.warrantIssuance, contractId: result.contractId };
    },
  },
];

function createMockClient(
  testCase: ComplexIssuanceReaderCase,
  data: unknown,
  options: { readonly createArgument?: unknown; readonly templateId?: string } = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : { [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        templateId: options.templateId ?? ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        createArgument,
      },
    },
  });
  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: ComplexIssuanceReaderCase, field: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType: testCase.entityType,
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  const parseError = error as OcpParseError;
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(field);
}

describe('decoder-backed complex issuance readers', () => {
  it.each(issuanceReaderCases)(
    '$entityType returns its exact canonical event and forwards readAs',
    async (testCase) => {
      const { client, getEventsByContractId } = createMockClient(testCase, testCase.validData());

      await expect(testCase.invoke(client, ['issuer::reader'])).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: testCase.contractId,
        readAs: ['issuer::reader'],
      });
    }
  );

  it.each(issuanceReaderCases)('$entityType rejects numeric primitives at the generated boundary', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.malformedNumericData());

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject a numeric primitive`);
    } catch (error: unknown) {
      expectDecoderFailure(
        error,
        testCase,
        testCase.entityType === 'equityCompensationIssuance' ? 'quantity' : 'amount'
      );
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects semantically invalid numeric strings', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.semanticallyInvalidNumericData());

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'numericString',
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects semantically invalid transaction dates', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(testCase.invoke(client)).rejects.toMatchObject({ code: OcpErrorCodes.INVALID_FORMAT });
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing required comments list', async (testCase) => {
    const data = testCase.validData();
    delete data.comments;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject missing comments`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'comments');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing required exemption list', async (testCase) => {
    const data = testCase.validData();
    delete data.security_law_exemptions;
    const { client } = createMockClient(testCase, data);

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject missing security_law_exemptions`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'security_law_exemptions');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects malformed nested exemption data', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      security_law_exemptions: [{ description: 'Reg D', jurisdiction: 17 }],
    });

    try {
      await testCase.invoke(client);
      throw new Error(`Expected ${testCase.entityType} reader to reject a malformed exemption`);
    } catch (error: unknown) {
      expectDecoderFailure(error, testCase, 'jurisdiction');
    }
  });

  it.each(issuanceReaderCases)('$entityType rejects malformed optional fields losslessly', async (testCase) => {
    const { client } = createMockClient(testCase, {
      ...testCase.validData(),
      board_approval_date: { seconds: 1 },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.board_approval_date',
        decoderMessage: 'raw object was decoded and encoded as null',
      },
    });
  });

  it.each(issuanceReaderCases)(
    '$entityType accepts omitted optional fields through generated null defaults',
    async (testCase) => {
      const data = testCase.validData();
      delete data.consideration_text;
      const { client } = createMockClient(testCase, data);

      const result = await testCase.invoke(client);
      expect(result.event.consideration_text).toBeUndefined();
      expect('consideration_text' in result.event).toBe(false);
    }
  );

  it.each(issuanceReaderCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), unexpected_field: true });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.unexpected_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a missing issuance_data wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: {} });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects whole-createArgument data lookalikes', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: testCase.validData(),
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects non-object nested issuance data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining(ENTITY_DATA_FIELD_MAP[testCase.entityType]),
    });
  });

  it.each(issuanceReaderCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
      contractId: testCase.contractId,
      templateId: wrongTemplateId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        actualTemplateId: wrongTemplateId,
      },
    });
  });

  it('convertible issuance preserves the non-empty conversion-trigger invariant', async () => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), conversion_triggers: [] });

    await expect(testCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(testCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'convertibleIssuance.conversion_triggers',
    });
  });

  it.each([
    ['fractional text', '1.5'],
    ['decimal text', '1.0'],
    ['scientific notation', '1e3'],
    ['a leading zero', '01'],
    ['positive overflow', '9007199254740992'],
    ['negative overflow', '-9007199254740992'],
  ])('convertible issuance rejects seniority encoded with %s', async (_description, seniority) => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), seniority });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'convertibleIssuance.seniority',
      receivedValue: seniority,
      context: {
        fieldPath: 'convertibleIssuance.seniority',
        receivedValue: seniority,
      },
    });
  });

  it.each([
    ['zero', '0', 0],
    ['a negative integer', '-2', -2],
    ['the positive safe boundary', '9007199254740991', Number.MAX_SAFE_INTEGER],
    ['the negative safe boundary', '-9007199254740991', Number.MIN_SAFE_INTEGER],
  ])('convertible issuance accepts seniority encoded as %s', async (_description, seniority, expected) => {
    const testCase = issuanceReaderCases[0];
    if (!testCase) throw new Error('Missing convertible issuance reader case');
    const { client } = createMockClient(testCase, { ...convertibleData(), seniority });

    await expect(testCase.invoke(client)).resolves.toMatchObject({
      event: { seniority: expected },
      contractId: testCase.contractId,
    });
  });

  it.each([
    ['fractional text', '1.5'],
    ['scientific notation', '1e3'],
    ['a leading zero', '090'],
    ['negative zero', '-0'],
    ['positive overflow', '9007199254740992'],
    ['negative overflow', '-9007199254740992'],
  ])('equity compensation issuance rejects a termination period encoded with %s', async (_description, period) => {
    const testCase = issuanceReaderCases[1];
    if (!testCase) throw new Error('Missing equity compensation issuance reader case');
    const data = equityCompensationData();
    const windows = data.termination_exercise_windows as Array<Record<string, unknown>>;
    const window = windows[0];
    if (!window) throw new Error('Missing termination exercise window fixture');
    data.termination_exercise_windows = [{ ...window, period }];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'equityCompensationIssuance.termination_exercise_windows.0.period',
      receivedValue: period,
      context: {
        fieldPath: 'equityCompensationIssuance.termination_exercise_windows.0.period',
        receivedValue: period,
      },
    });
  });

  it.each([
    ['zero', '0', 0],
    ['a negative integer', '-30', -30],
    ['a zero-only fractional suffix', '90.0000000000', 90],
    ['the positive safe boundary', '9007199254740991.0', Number.MAX_SAFE_INTEGER],
    ['the negative safe boundary', '-9007199254740991.0', Number.MIN_SAFE_INTEGER],
  ])(
    'equity compensation issuance accepts a termination period encoded as %s',
    async (_description, period, expected) => {
      const testCase = issuanceReaderCases[1];
      if (!testCase) throw new Error('Missing equity compensation issuance reader case');
      const data = equityCompensationData();
      const windows = data.termination_exercise_windows as Array<Record<string, unknown>>;
      const window = windows[0];
      if (!window) throw new Error('Missing termination exercise window fixture');
      data.termination_exercise_windows = [{ ...window, period }];
      const { client } = createMockClient(testCase, data);

      await expect(testCase.invoke(client)).resolves.toMatchObject({
        event: {
          termination_exercise_windows: [{ period: expected }],
        },
        contractId: testCase.contractId,
      });
    }
  );

  it('warrant issuance rejects a convertible conversion right after exact decoding', async () => {
    const testCase = issuanceReaderCases[2];
    if (!testCase) throw new Error('Missing warrant issuance reader case');
    const data = warrantData();
    const warrantTrigger = (data.exercise_triggers as Array<Record<string, unknown>>)[0];
    const convertibleTrigger = (convertibleData().conversion_triggers as Array<Record<string, unknown>>)[0];
    if (!warrantTrigger || !convertibleTrigger) throw new Error('Missing issuance trigger fixture');
    data.exercise_triggers = [
      {
        ...warrantTrigger,
        conversion_right: { tag: 'OcfRightConvertible', value: convertibleTrigger.conversion_right },
      },
    ];
    const { client } = createMockClient(testCase, data);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'warrantIssuance.conversion_right.tag',
    });
  });
});

describe('decoder-backed equity-compensation pricing invariants', () => {
  const equityCase = issuanceReaderCases[1];
  if (!equityCase) throw new Error('Missing equity compensation issuance reader case');

  it.each([
    ['OPTION', 'OPTION_ISO', 'exercise_price'],
    ['SAR', 'CSAR', 'base_price'],
    ['RSU', 'RSU', null],
  ] as const)('accepts valid %s pricing', async (variant, compensationType, expectedPriceField) => {
    const { client } = createMockClient(equityCase, equityCompensationData(variant));

    const result = await equityCase.invoke(client);
    if (result.event.object_type !== 'TX_EQUITY_COMPENSATION_ISSUANCE') {
      throw new Error('Expected an equity compensation issuance result');
    }
    expect(result.event.compensation_type).toBe(compensationType);
    if (expectedPriceField !== null) expect(result.event).toHaveProperty(expectedPriceField);
  });

  it.each([
    ['OPTION', 'exercise_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['OPTION', 'base_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['SAR', 'base_price', null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['SAR', 'exercise_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['RSU', 'exercise_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
    ['RSU', 'base_price', { amount: '1', currency: 'USD' }, OcpErrorCodes.INVALID_FORMAT],
  ] as const)('rejects invalid %s %s pricing after decoding', async (variant, field, value, expectedCode) => {
    const data = equityCompensationData(variant);
    data[field] = value;
    const { client } = createMockClient(equityCase, data);

    await expect(equityCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: expectedCode,
      fieldPath: `equityCompensationIssuance.${field}`,
    });
  });
});
