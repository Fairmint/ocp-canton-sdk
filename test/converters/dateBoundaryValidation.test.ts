import { OcpErrorCodes } from '../../src/errors';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
import {
  damlEquityCompensationIssuanceDataToNative as convertTypedEquityCompensationIssuance,
  type DamlEquityCompensationIssuanceData,
} from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';
import { issuerAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/createIssuerAuthorizedSharesAdjustment';
import { damlIssuerAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/issuerAuthorizedSharesAdjustment/getIssuerAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassDataToNative } from '../../src/functions/OpenCapTable/stockClass/getStockClassAsOcf';
import { stockClassDataToDaml } from '../../src/functions/OpenCapTable/stockClass/stockClassDataToDaml';
import { stockClassAuthorizedSharesAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/createStockClassAuthorizedSharesAdjustment';
import { damlStockClassAuthorizedSharesAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockClassAuthorizedSharesAdjustment/getStockClassAuthorizedSharesAdjustmentAsOcf';
import { damlStockClassSplitToNative } from '../../src/functions/OpenCapTable/stockClassSplit/damlToStockClassSplit';
import { stockIssuanceDataToDaml } from '../../src/functions/OpenCapTable/stockIssuance/createStockIssuance';
import {
  damlStockIssuanceDataToNative as convertTypedStockIssuance,
  type DamlStockIssuanceData,
} from '../../src/functions/OpenCapTable/stockIssuance/getStockIssuanceAsOcf';
import { stockPlanPoolAdjustmentDataToDaml } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/createStockPlanPoolAdjustment';
import { damlStockPlanPoolAdjustmentDataToNative } from '../../src/functions/OpenCapTable/stockPlanPoolAdjustment/getStockPlanPoolAdjustmentAsOcf';
import { expectInvalidDate } from '../utils/dateValidationAssertions';

const damlEquityCompensationIssuanceDataToNative = (value: unknown) =>
  convertTypedEquityCompensationIssuance(value as DamlEquityCompensationIssuanceData);
const damlStockIssuanceDataToNative = (value: unknown) => convertTypedStockIssuance(value as DamlStockIssuanceData);

const ISSUER_ADJUSTMENT_BASE = {
  id: 'adjustment-1',
  issuer_id: 'issuer-1',
  date: '2024-01-15T00:00:00Z',
  new_shares_authorized: '1000',
};

const STOCK_PLAN_POOL_ADJUSTMENT_BASE = {
  id: 'pool-adjustment-1',
  date: '2024-01-15T00:00:00Z',
  stock_plan_id: 'plan-1',
  shares_reserved: '1000',
  board_approval_date: null,
  stockholder_approval_date: null,
  comments: [],
};

const STOCK_PLAN_POOL_ADJUSTMENT_WRITE_BASE = {
  id: STOCK_PLAN_POOL_ADJUSTMENT_BASE.id,
  date: '2024-01-15',
  stock_plan_id: STOCK_PLAN_POOL_ADJUSTMENT_BASE.stock_plan_id,
  shares_reserved: STOCK_PLAN_POOL_ADJUSTMENT_BASE.shares_reserved,
  comments: STOCK_PLAN_POOL_ADJUSTMENT_BASE.comments,
};

const STOCK_CLASS_ADJUSTMENT_BASE = {
  id: 'stock-class-adjustment-1',
  date: '2024-01-15T00:00:00Z',
  stock_class_id: 'stock-class-1',
  new_shares_authorized: '1000',
  comments: [],
};

const EQUITY_COMPENSATION_ISSUANCE_BASE = {
  id: 'equity-compensation-1',
  date: '2024-01-15T00:00:00Z',
  security_id: 'security-1',
  custom_id: 'OPTION-1',
  stakeholder_id: 'stakeholder-1',
  compensation_type: 'OcfCompensationTypeOption',
  quantity: '1000',
  base_price: null,
  exercise_price: { amount: '1', currency: 'USD' },
  expiration_date: null,
  board_approval_date: null,
  consideration_text: null,
  early_exercisable: null,
  stock_class_id: null,
  stock_plan_id: null,
  stockholder_approval_date: null,
  vesting_terms_id: null,
  vestings: [],
  termination_exercise_windows: [],
  security_law_exemptions: [],
  comments: [],
};

const EQUITY_COMPENSATION_WRITE_BASE = {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
  id: 'equity-compensation-1',
  date: '2024-01-15',
  security_id: 'security-1',
  custom_id: 'OPTION-1',
  stakeholder_id: 'stakeholder-1',
  compensation_type: 'OPTION' as const,
  quantity: '1000',
  exercise_price: { amount: '1', currency: 'USD' },
  expiration_date: null,
  termination_exercise_windows: [],
  security_law_exemptions: [],
};

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected conversion to fail');
}

function expectEquityGeneratedParse(error: unknown, decoderPath: string): void {
  expect(error).toMatchObject({
    name: 'OcpParseError',
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    source: 'damlEntityData.equityCompensationIssuance',
    context: expect.objectContaining({ decoderPath }),
  });
}

const STOCK_ISSUANCE_WRITE_BASE: Parameters<typeof stockIssuanceDataToDaml>[0] = {
  object_type: 'TX_STOCK_ISSUANCE',
  id: 'stock-issuance-1',
  date: '2024-01-15',
  security_id: 'security-1',
  custom_id: 'CS-1',
  stakeholder_id: 'stakeholder-1',
  stock_class_id: 'stock-class-1',
  share_price: { amount: '1', currency: 'USD' },
  quantity: '100',
  security_law_exemptions: [],
  stock_legend_ids: [],
};

const STOCK_CLASS_WRITE_BASE: Parameters<typeof stockClassDataToDaml>[0] = {
  object_type: 'STOCK_CLASS',
  id: 'preferred-1',
  name: 'Preferred',
  class_type: 'PREFERRED',
  default_id_prefix: 'P-',
  initial_shares_authorized: '1000',
  votes_per_share: '1',
  seniority: '1',
  conversion_rights: [],
};

const OPTIONAL_READ_DATE_CASES: Array<{
  name: string;
  fieldPath: string;
  generatedBoundary?: boolean;
  structuralObjectFailure?: boolean;
  convert: (value: unknown) => unknown;
}> = [
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `issuer adjustment ${field}`,
    fieldPath: `issuerAuthorizedSharesAdjustment.${field}`,
    structuralObjectFailure: true,
    convert: (value: unknown) =>
      damlIssuerAuthorizedSharesAdjustmentDataToNative({
        ...ISSUER_ADJUSTMENT_BASE,
        board_approval_date: null,
        stockholder_approval_date: null,
        comments: [],
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock plan pool adjustment ${field}`,
    fieldPath: `stockPlanPoolAdjustment.${field}`,
    structuralObjectFailure: true,
    convert: (value: unknown) =>
      damlStockPlanPoolAdjustmentDataToNative({
        ...STOCK_PLAN_POOL_ADJUSTMENT_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class adjustment ${field}`,
    fieldPath: `stockClassAuthorizedSharesAdjustment.${field}`,
    structuralObjectFailure: true,
    convert: (value: unknown) =>
      damlStockClassAuthorizedSharesAdjustmentDataToNative({
        ...STOCK_CLASS_ADJUSTMENT_BASE,
        board_approval_date: null,
        stockholder_approval_date: null,
        [field]: value,
      }),
  })),
  ...(['expiration_date', 'board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `equity compensation issuance ${field}`,
    fieldPath: `equityCompensationIssuance.${field}`,
    generatedBoundary: true,
    structuralObjectFailure: true,
    convert: (value: unknown) =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class ${field}`,
    fieldPath: `stockClass.${field}`,
    convert: (value: unknown) =>
      damlStockClassDataToNative({
        ...stockClassDataToDaml(STOCK_CLASS_WRITE_BASE),
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock issuance ${field}`,
    fieldPath: `stockIssuance.${field}`,
    generatedBoundary: true,
    structuralObjectFailure: true,
    convert: (value: unknown) =>
      damlStockIssuanceDataToNative({
        ...stockIssuanceDataToDaml(STOCK_ISSUANCE_WRITE_BASE),
        [field]: value,
      }),
  })),
];

const OPTIONAL_WRITE_DATE_CASES: Array<{
  name: string;
  field: 'board_approval_date' | 'stockholder_approval_date';
  fieldPath: string;
  rejectExplicitNull?: boolean;
  convert: (value: unknown) => Record<string, unknown>;
}> = [
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `issuer adjustment ${field}`,
    field,
    fieldPath: `issuerAuthorizedSharesAdjustment.${field}`,
    rejectExplicitNull: true,
    convert: (value: unknown) =>
      issuerAuthorizedSharesAdjustmentDataToDaml({
        ...ISSUER_ADJUSTMENT_BASE,
        object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
        date: '2024-01-15',
        ...(value === undefined ? {} : { [field]: value }),
      } as unknown as Parameters<typeof issuerAuthorizedSharesAdjustmentDataToDaml>[0]),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock plan pool adjustment ${field}`,
    field,
    fieldPath: `stockPlanPoolAdjustment.${field}`,
    rejectExplicitNull: true,
    convert: (value: unknown) =>
      stockPlanPoolAdjustmentDataToDaml({
        ...STOCK_PLAN_POOL_ADJUSTMENT_WRITE_BASE,
        object_type: 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
        ...(value === undefined ? {} : { [field]: value }),
      } as unknown as Parameters<typeof stockPlanPoolAdjustmentDataToDaml>[0]),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class adjustment ${field}`,
    field,
    fieldPath: `stockClassAuthorizedSharesAdjustment.${field}`,
    rejectExplicitNull: true,
    convert: (value: unknown) =>
      stockClassAuthorizedSharesAdjustmentDataToDaml({
        ...STOCK_CLASS_ADJUSTMENT_BASE,
        object_type: 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
        date: '2024-01-15',
        ...(value === undefined ? {} : { [field]: value }),
      } as unknown as Parameters<typeof stockClassAuthorizedSharesAdjustmentDataToDaml>[0]),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `equity compensation issuance ${field}`,
    field,
    fieldPath: `equityCompensationIssuance.${field}`,
    rejectExplicitNull: true,
    convert: (value: unknown) =>
      equityCompensationIssuanceDataToDaml({
        ...EQUITY_COMPENSATION_WRITE_BASE,
        ...(value === undefined ? {} : { [field]: value }),
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock class ${field}`,
    field,
    fieldPath: `stockClass.${field}`,
    convert: (value: unknown) =>
      stockClassDataToDaml({
        ...STOCK_CLASS_WRITE_BASE,
        [field]: value,
      }),
  })),
  ...(['board_approval_date', 'stockholder_approval_date'] as const).map((field) => ({
    name: `stock issuance ${field}`,
    field,
    fieldPath: `stockIssuance.${field}`,
    rejectExplicitNull: true,
    convert: (value: unknown) =>
      stockIssuanceDataToDaml({
        ...STOCK_ISSUANCE_WRITE_BASE,
        ...(value === undefined ? {} : { [field]: value }),
      }),
  })),
];

describe('DAML read converter date boundaries', () => {
  test('preserves the lexical date when an offset crosses the UTC day', () => {
    const result = damlStockClassSplitToNative({
      id: 'split-1',
      date: '2024-01-15T23:30:00-05:00',
      stock_class_id: 'class-1',
      split_ratio: { numerator: '2', denominator: '1' },
      comments: [],
    });

    expect(result.date).toBe('2024-01-15');
  });

  test.each(['2024-02-30T00:00:00Z', '2024-01-15T00:00:00', '2024-01-15T25:00:00Z'])(
    'rejects malformed required converter date %s',
    (date) => {
      expectInvalidDate(
        () =>
          damlStockClassSplitToNative({
            id: 'split-1',
            date,
            stock_class_id: 'class-1',
            split_ratio: { numerator: '2', denominator: '1' },
            comments: [],
          }),
        'stockClassSplit.date',
        date
      );
    }
  );

  test('identifies the exact invalid optional approval field', () => {
    const boardApprovalDate = '2023-02-29T00:00:00Z';

    expectInvalidDate(
      () =>
        damlIssuerAuthorizedSharesAdjustmentDataToNative({
          id: 'adjustment-1',
          issuer_id: 'issuer-1',
          date: '2024-01-15T00:00:00Z',
          new_shares_authorized: '1000',
          board_approval_date: boardApprovalDate,
          stockholder_approval_date: null,
          comments: [],
        }),
      'issuerAuthorizedSharesAdjustment.board_approval_date',
      boardApprovalDate
    );
  });
  test('rejects a non-string optional date as a structural generated-DAML failure', () => {
    const stockholderApprovalDate = { seconds: 1 };

    expect(() =>
      damlIssuerAuthorizedSharesAdjustmentDataToNative({
        id: 'adjustment-1',
        issuer_id: 'issuer-1',
        date: '2024-01-15T00:00:00Z',
        new_shares_authorized: '1000',
        board_approval_date: null,
        stockholder_approval_date: stockholderApprovalDate,
        comments: [],
      } as unknown as Parameters<typeof damlIssuerAuthorizedSharesAdjustmentDataToNative>[0])
    ).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'issuerAuthorizedSharesAdjustment.stockholder_approval_date',
      })
    );
  });

  test.each(OPTIONAL_READ_DATE_CASES)('rejects a present empty $name', ({ convert, fieldPath }) => {
    expectInvalidDate(() => convert(''), fieldPath, '');
  });

  test.each(OPTIONAL_READ_DATE_CASES.filter(({ structuralObjectFailure }) => structuralObjectFailure !== true))(
    'rejects a present non-string $name',
    ({ convert, fieldPath }) => {
      const invalidDate = { seconds: 1 };
      expectInvalidDate(() => convert(invalidDate), fieldPath, invalidDate, OcpErrorCodes.INVALID_TYPE);
    }
  );

  test.each(OPTIONAL_READ_DATE_CASES.filter(({ structuralObjectFailure }) => structuralObjectFailure === true))(
    'rejects a present non-string $name as a structural generated-DAML failure',
    ({ convert, fieldPath, generatedBoundary }) => {
      const invalidDate = { seconds: 1 };
      if (generatedBoundary === true) {
        const separator = fieldPath.indexOf('.');
        const entityType = fieldPath.slice(0, separator);
        const decoderPath = `input.${fieldPath.slice(separator + 1)}`;
        expect(() => convert(invalidDate)).toThrow(
          expect.objectContaining({
            name: 'OcpParseError',
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source: `damlEntityData.${entityType}`,
            context: expect.objectContaining({ decoderPath }),
          })
        );
      } else {
        expect(() => convert(invalidDate)).toThrow(
          expect.objectContaining({
            name: 'OcpParseError',
            code: OcpErrorCodes.SCHEMA_MISMATCH,
            source: fieldPath,
          })
        );
      }
    }
  );

  test.each(OPTIONAL_READ_DATE_CASES)('accepts a null $name as absent', ({ convert }) => {
    expect(() => convert(null)).not.toThrow();
  });

  test('rejects an undefined required-nullable equity expiration on readback', () => {
    expect(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        expiration_date: undefined,
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        source: 'damlEntityData.equityCompensationIssuance',
        context: expect.objectContaining({ decoderPath: 'input.expiration_date' }),
      })
    );
  });
});

describe('OCF write converter optional date boundaries', () => {
  test.each(OPTIONAL_WRITE_DATE_CASES)('rejects a present empty $name', ({ convert, fieldPath }) => {
    expectInvalidDate(() => convert(''), fieldPath, '');
  });

  test.each(OPTIONAL_WRITE_DATE_CASES)('rejects a present non-string $name', ({ convert, fieldPath }) => {
    const invalidDate = { seconds: 1 };
    expectInvalidDate(() => convert(invalidDate), fieldPath, invalidDate, OcpErrorCodes.INVALID_TYPE);
  });

  test.each(OPTIONAL_WRITE_DATE_CASES)('encodes an undefined $name as absent', ({ convert, field }) => {
    expect(convert(undefined)[field]).toBeNull();
  });

  test.each(OPTIONAL_WRITE_DATE_CASES.filter(({ rejectExplicitNull }) => rejectExplicitNull === true))(
    'rejects an explicit null $name',
    ({ convert, fieldPath }) => {
      expectInvalidDate(() => convert(null), fieldPath, null, OcpErrorCodes.INVALID_TYPE);
    }
  );

  test.each(OPTIONAL_WRITE_DATE_CASES.filter(({ rejectExplicitNull }) => rejectExplicitNull !== true))(
    'encodes a null $name as absent',
    ({ convert, field }) => {
      expect(convert(null)[field]).toBeNull();
    }
  );

  test('reports contextual paths for required and nested write dates', () => {
    expectInvalidDate(
      () =>
        issuerAuthorizedSharesAdjustmentDataToDaml({
          ...ISSUER_ADJUSTMENT_BASE,
          object_type: 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
          date: '',
        }),
      'issuerAuthorizedSharesAdjustment.date',
      ''
    );

    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          vestings: [
            { date: '2024-01-15', amount: '1' },
            { date: '', amount: '1' },
          ],
        }),
      'equityCompensationIssuance.vestings[1].date',
      ''
    );
  });

  test('validates an equity-compensation vesting date before filtering its zero amount', () => {
    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          vestings: [{ date: 'not-a-date', amount: '0' }],
        }),
      'equityCompensationIssuance.vestings[0].date',
      'not-a-date'
    );
  });

  test('reports original array indexes for nested issuance dates', () => {
    expectInvalidDate(
      () =>
        damlEquityCompensationIssuanceDataToNative({
          ...EQUITY_COMPENSATION_ISSUANCE_BASE,
          vestings: [
            { date: '2024-01-15T00:00:00Z', amount: '1' },
            { date: '', amount: '1' },
          ],
        }),
      'equityCompensationIssuance.vestings[1].date',
      ''
    );

    expectInvalidDate(
      () =>
        stockIssuanceDataToDaml({
          ...STOCK_ISSUANCE_WRITE_BASE,
          vestings: [
            { date: '2024-01-15', amount: '1' },
            { date: '', amount: '1' },
          ],
        }),
      'stockIssuance.vestings[1].date',
      ''
    );
  });

  test('reports the original array index for an invalid equity-compensation vesting amount', () => {
    const invalidAmount = { value: '1' };
    try {
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        vestings: [
          { date: '2024-01-15T00:00:00Z', amount: '1' },
          { date: '2024-01-16T00:00:00Z', amount: invalidAmount },
        ],
      });
    } catch (error) {
      expectEquityGeneratedParse(error, 'input.vestings[1].amount');
      return;
    }
    throw new Error('Expected invalid vesting amount to be rejected');
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-a-vesting'],
  ] as const)('rejects a %s equity-compensation vesting with an indexed structured error', (_case, invalidVesting) => {
    try {
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        vestings: [{ date: '2024-01-15T00:00:00Z', amount: '1' }, invalidVesting],
      });
    } catch (error) {
      expectEquityGeneratedParse(error, 'input.vestings[1]');
      return;
    }
    throw new Error('Expected malformed vesting to be rejected');
  });

  test.each(['termination_exercise_windows', 'security_law_exemptions'] as const)(
    'rejects a present non-array %s collection',
    (field) => {
      const invalidValue = { not: 'an array' };
      const error = captureError(() =>
        damlEquityCompensationIssuanceDataToNative({
          ...EQUITY_COMPENSATION_ISSUANCE_BASE,
          [field]: invalidValue,
        })
      );

      expectEquityGeneratedParse(error, `input.${field}`);
    }
  );

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-a-window'],
  ] as const)('rejects a %s termination window with an indexed structured error', (_case, invalidWindow) => {
    const error = captureError(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        termination_exercise_windows: [
          { reason: 'OcfTermVoluntaryOther', period: '1', period_type: 'OcfPeriodDays' },
          invalidWindow,
        ],
      })
    );

    expectEquityGeneratedParse(error, 'input.termination_exercise_windows[1]');
  });

  test.each([
    ['reason', 'OcfTermUnknown'],
    ['period_type', 'OcfPeriodUnknown'],
    ['period', {}],
  ] as const)('reports the indexed termination-window %s field', (field, invalidValue) => {
    const error = captureError(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        termination_exercise_windows: [
          { reason: 'OcfTermVoluntaryOther', period: '1', period_type: 'OcfPeriodDays' },
          {
            reason: 'OcfTermVoluntaryOther',
            period: '1',
            period_type: 'OcfPeriodDays',
            [field]: invalidValue,
          },
        ],
      })
    );

    expectEquityGeneratedParse(error, `input.termination_exercise_windows[1].${field}`);
  });

  test.each([
    ['null', null],
    ['array', []],
    ['primitive', 'not-an-exemption'],
  ] as const)('rejects a %s security exemption with an indexed structured error', (_case, invalidExemption) => {
    const error = captureError(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        security_law_exemptions: [{ description: 'Rule 701', jurisdiction: 'US' }, invalidExemption],
      })
    );

    expectEquityGeneratedParse(error, 'input.security_law_exemptions[1]');
  });

  test('reports the indexed security-exemption description field', () => {
    const invalidValue = 42;
    const error = captureError(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...EQUITY_COMPENSATION_ISSUANCE_BASE,
        security_law_exemptions: [
          { description: 'Rule 701', jurisdiction: 'US' },
          { description: invalidValue, jurisdiction: 'US' },
        ],
      })
    );

    expectEquityGeneratedParse(error, 'input.security_law_exemptions[1].description');
  });

  test('rejects an empty security-exemption jurisdiction', () => {
    expect(
      captureError(() =>
        damlEquityCompensationIssuanceDataToNative({
          ...EQUITY_COMPENSATION_ISSUANCE_BASE,
          security_law_exemptions: [{ description: 'Rule 701', jurisdiction: '' }],
        })
      )
    ).toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: 'equityCompensationIssuance.security_law_exemptions[0].jurisdiction',
      receivedValue: '',
    });
  });

  test.each([
    ['undefined', undefined, OcpErrorCodes.INVALID_TYPE],
    ['empty', '', OcpErrorCodes.INVALID_FORMAT],
    ['non-string', { seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('rejects a required-nullable equity expiration when %s', (_case, value, code) => {
    expectInvalidDate(
      () =>
        equityCompensationIssuanceDataToDaml({
          ...EQUITY_COMPENSATION_WRITE_BASE,
          expiration_date: value,
        } as unknown as Parameters<typeof equityCompensationIssuanceDataToDaml>[0]),
      'equityCompensationIssuance.expiration_date',
      value,
      code
    );
  });

  test('accepts explicit null for a required-nullable equity expiration', () => {
    expect(equityCompensationIssuanceDataToDaml(EQUITY_COMPENSATION_WRITE_BASE).expiration_date).toBeNull();
  });
});
