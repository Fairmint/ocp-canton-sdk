import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import { parseOcfObject } from '../../src/utils/ocfZodSchemas';

const commonIssuance = {
  object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE',
  id: 'issuance-1',
  date: '2026-01-01',
  security_id: 'security-1',
  custom_id: 'EQ-1',
  stakeholder_id: 'stakeholder-1',
  quantity: '100',
  security_law_exemptions: [],
  expiration_date: null,
  termination_exercise_windows: [],
};

const monetary = { amount: '1', currency: 'USD' };

function expectInvalid(input: Record<string, unknown>, fieldPath: string, code?: OcpErrorCode): void {
  try {
    parseOcfObject(input);
    throw new Error('Expected parsing to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(OcpValidationError);
    expect((error as OcpValidationError).fieldPath).toContain(fieldPath);
    if (code !== undefined) {
      expect((error as OcpValidationError).code).toBe(code);
    }
  }
}

describe('equity compensation issuance conditional pricing', () => {
  it.each(['OPTION', 'OPTION_ISO', 'OPTION_NSO'] as const)('requires exercise_price for %s', (compensationType) => {
    expect(
      parseOcfObject({
        ...commonIssuance,
        compensation_type: compensationType,
        exercise_price: monetary,
      })
    ).toMatchObject({
      compensation_type: compensationType,
      exercise_price: monetary,
    });

    expectInvalid({ ...commonIssuance, compensation_type: compensationType }, 'exercise_price');
  });

  it.each(['CSAR', 'SSAR'] as const)('requires base_price for %s', (compensationType) => {
    expect(
      parseOcfObject({
        ...commonIssuance,
        compensation_type: compensationType,
        base_price: monetary,
      })
    ).toMatchObject({
      compensation_type: compensationType,
      base_price: monetary,
    });

    expectInvalid({ ...commonIssuance, compensation_type: compensationType }, 'base_price');
  });

  it('accepts RSUs without pricing', () => {
    expect(parseOcfObject({ ...commonIssuance, compensation_type: 'RSU' })).toMatchObject({
      compensation_type: 'RSU',
    });
  });

  it.each([
    {
      name: 'option with a SAR base price',
      input: {
        ...commonIssuance,
        compensation_type: 'OPTION',
        exercise_price: monetary,
        base_price: monetary,
      },
      field: 'base_price',
    },
    {
      name: 'SAR with an option exercise price',
      input: {
        ...commonIssuance,
        compensation_type: 'CSAR',
        base_price: monetary,
        exercise_price: monetary,
      },
      field: 'exercise_price',
    },
    {
      name: 'RSU with an exercise price',
      input: {
        ...commonIssuance,
        compensation_type: 'RSU',
        exercise_price: monetary,
      },
      field: 'exercise_price',
    },
    {
      name: 'RSU with a base price',
      input: {
        ...commonIssuance,
        compensation_type: 'RSU',
        base_price: monetary,
      },
      field: 'base_price',
    },
  ])('rejects $name', ({ input, field }) => {
    expectInvalid(input, field);
  });

  it.each([
    {
      name: 'option null base price',
      input: {
        ...commonIssuance,
        compensation_type: 'OPTION',
        exercise_price: monetary,
        base_price: null,
      },
      field: 'base_price',
    },
    {
      name: 'option null required exercise price',
      input: { ...commonIssuance, compensation_type: 'OPTION', exercise_price: null },
      field: 'exercise_price',
    },
    {
      name: 'SAR null exercise price',
      input: {
        ...commonIssuance,
        compensation_type: 'CSAR',
        base_price: monetary,
        exercise_price: null,
      },
      field: 'exercise_price',
    },
    {
      name: 'SAR null required base price',
      input: { ...commonIssuance, compensation_type: 'CSAR', base_price: null },
      field: 'base_price',
    },
    {
      name: 'RSU null pricing',
      input: { ...commonIssuance, compensation_type: 'RSU', exercise_price: null },
      field: 'exercise_price',
    },
  ])('rejects $name before schema parsing', ({ input, field }) => {
    expectInvalid(input, field, OcpErrorCodes.INVALID_TYPE);
  });
});
