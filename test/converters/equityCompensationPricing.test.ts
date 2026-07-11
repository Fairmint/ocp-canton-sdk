import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { validateEquityCompensationPricing } from '../../src/functions/OpenCapTable/equityCompensationIssuance/equityCompensationPricing';
import { damlEquityCompensationIssuanceDataToNative as convertTypedEquityCompensationIssuance } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';

const damlEquityCompensationIssuanceDataToNative = (value: unknown) =>
  convertTypedEquityCompensationIssuance(value as Parameters<typeof convertTypedEquityCompensationIssuance>[0]);

const monetary = { amount: '1', currency: 'USD' };

describe('validateEquityCompensationPricing', () => {
  it.each(['OPTION', 'OPTION_ISO', 'OPTION_NSO'] as const)('accepts exercise pricing for %s', (compensationType) => {
    expect(validateEquityCompensationPricing(compensationType, monetary, undefined, 'issuance')).toEqual({
      compensation_type: compensationType,
      exercise_price: monetary,
    });
  });

  it.each(['CSAR', 'SSAR'] as const)('accepts base pricing for %s', (compensationType) => {
    expect(validateEquityCompensationPricing(compensationType, undefined, monetary, 'issuance')).toEqual({
      compensation_type: compensationType,
      base_price: monetary,
    });
  });

  it('accepts an RSU without pricing', () => {
    expect(validateEquityCompensationPricing('RSU', undefined, undefined, 'issuance')).toEqual({
      compensation_type: 'RSU',
    });
  });

  it.each([
    {
      name: 'option without exercise price',
      compensationType: 'OPTION' as const,
      exercisePrice: undefined,
      basePrice: undefined,
      field: 'exercise_price',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    },
    {
      name: 'option with null exercise price',
      compensationType: 'OPTION' as const,
      exercisePrice: null,
      basePrice: undefined,
      field: 'exercise_price',
      code: OcpErrorCodes.INVALID_TYPE,
    },
    {
      name: 'option with malformed exercise price',
      compensationType: 'OPTION' as const,
      exercisePrice: { amount: '1' },
      basePrice: undefined,
      field: 'exercise_price.currency',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    },
    {
      name: 'option with base price',
      compensationType: 'OPTION_ISO' as const,
      exercisePrice: monetary,
      basePrice: monetary,
      field: 'base_price',
      code: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'SAR without base price',
      compensationType: 'CSAR' as const,
      exercisePrice: undefined,
      basePrice: undefined,
      field: 'base_price',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    },
    {
      name: 'SAR with null base price',
      compensationType: 'CSAR' as const,
      exercisePrice: undefined,
      basePrice: null,
      field: 'base_price',
      code: OcpErrorCodes.INVALID_TYPE,
    },
    {
      name: 'SAR with exercise price',
      compensationType: 'SSAR' as const,
      exercisePrice: monetary,
      basePrice: monetary,
      field: 'exercise_price',
      code: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'RSU with exercise price',
      compensationType: 'RSU' as const,
      exercisePrice: monetary,
      basePrice: undefined,
      field: 'exercise_price',
      code: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'RSU with base price',
      compensationType: 'RSU' as const,
      exercisePrice: undefined,
      basePrice: monetary,
      field: 'base_price',
      code: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'RSU with null exercise price',
      compensationType: 'RSU' as const,
      exercisePrice: null,
      basePrice: undefined,
      field: 'exercise_price',
      code: OcpErrorCodes.INVALID_TYPE,
    },
  ])('rejects $name', ({ compensationType, exercisePrice, basePrice, field, code }) => {
    try {
      validateEquityCompensationPricing(compensationType, exercisePrice, basePrice, 'issuance');
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath: `issuance.${field}`,
        code,
      });
    }
  });
});

describe('equity compensation ledger pricing boundary', () => {
  const ledgerIssuanceBase = {
    id: 'issuance-1',
    date: '2026-01-01',
    security_id: 'security-1',
    custom_id: 'EQ-1',
    stakeholder_id: 'stakeholder-1',
    quantity: '100',
    comments: [],
    security_law_exemptions: [],
    vestings: [],
    expiration_date: null,
    termination_exercise_windows: [],
    board_approval_date: null,
    consideration_text: null,
    early_exercisable: null,
    stock_class_id: null,
    stock_plan_id: null,
    stockholder_approval_date: null,
    vesting_terms_id: null,
  };

  const malformedMonetaryValues: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: 'zero', value: 0 },
    { name: 'false', value: false },
    { name: 'an empty string', value: '' },
    { name: 'an array', value: [] },
  ];

  function expectInvalidLedgerPrice(convert: () => unknown, fieldPath: string, _receivedValue: unknown): void {
    try {
      convert();
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        source: 'damlEntityData.equityCompensationIssuance',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: { decoderPath: `input.${fieldPath.replace('equityCompensationIssuance.', '')}` },
      });
      expect(JSON.stringify(error).length).toBeLessThan(2_000);
    }
  }

  it.each(malformedMonetaryValues)(
    'rejects $name as an OPTION base_price instead of treating it as absent',
    ({ value }) => {
      expectInvalidLedgerPrice(
        () =>
          damlEquityCompensationIssuanceDataToNative({
            ...ledgerIssuanceBase,
            compensation_type: 'OcfCompensationTypeOption',
            exercise_price: monetary,
            base_price: value,
          }),
        'equityCompensationIssuance.base_price',
        value
      );
    }
  );

  it.each(malformedMonetaryValues)(
    'rejects $name as a SAR exercise_price instead of treating it as absent',
    ({ value }) => {
      expectInvalidLedgerPrice(
        () =>
          damlEquityCompensationIssuanceDataToNative({
            ...ledgerIssuanceBase,
            compensation_type: 'OcfCompensationTypeCSAR',
            exercise_price: value,
            base_price: monetary,
          }),
        'equityCompensationIssuance.exercise_price',
        value
      );
    }
  );

  it.each(malformedMonetaryValues)(
    'rejects $name as an RSU exercise_price instead of treating it as absent',
    ({ value }) => {
      expectInvalidLedgerPrice(
        () =>
          damlEquityCompensationIssuanceDataToNative({
            ...ledgerIssuanceBase,
            compensation_type: 'OcfCompensationTypeRSU',
            exercise_price: value,
            base_price: null,
          }),
        'equityCompensationIssuance.exercise_price',
        value
      );
    }
  );

  it('reports malformed Monetary object fields with their contextual path', () => {
    try {
      damlEquityCompensationIssuanceDataToNative({
        ...ledgerIssuanceBase,
        compensation_type: 'OcfCompensationTypeOption',
        exercise_price: {},
        base_price: null,
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      expect(error).toMatchObject({
        source: 'damlEntityData.equityCompensationIssuance',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: { decoderPath: 'input.exercise_price' },
      });
    }
  });

  it('continues to treat null DAML optionals as absent', () => {
    expect(
      damlEquityCompensationIssuanceDataToNative({
        ...ledgerIssuanceBase,
        compensation_type: 'OcfCompensationTypeRSU',
        exercise_price: null,
        base_price: null,
      })
    ).toMatchObject({
      compensation_type: 'RSU',
    });
  });
});
