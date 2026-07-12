import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { validateEquityCompensationPricing } from '../../src/functions/OpenCapTable/equityCompensationIssuance/equityCompensationPricing';
import { damlEquityCompensationIssuanceDataToNative } from '../../src/functions/OpenCapTable/equityCompensationIssuance/getEquityCompensationIssuanceAsOcf';

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
      code: OcpErrorCodes.INVALID_TYPE,
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
    security_law_exemptions: [],
    expiration_date: null,
    termination_exercise_windows: [],
  };

  const malformedMonetaryValues: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: 'zero', value: 0 },
    { name: 'false', value: false },
    { name: 'an empty string', value: '' },
    { name: 'an array', value: [] },
  ];

  function expectInvalidLedgerPrice(convert: () => unknown, fieldPath: string, receivedValue: unknown): void {
    try {
      convert();
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath,
        code: OcpErrorCodes.INVALID_TYPE,
        receivedValue,
      });
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
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        fieldPath: 'equityCompensationIssuance.exercise_price.amount',
        code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
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

  it('decodes DAML [] vestings as omission and preserves non-empty vestings', () => {
    const base = {
      ...ledgerIssuanceBase,
      compensation_type: 'OcfCompensationTypeRSU',
      exercise_price: null,
      base_price: null,
    };
    expect(damlEquityCompensationIssuanceDataToNative({ ...base, vestings: [] })).not.toHaveProperty('vestings');
    expect(
      damlEquityCompensationIssuanceDataToNative({
        ...base,
        vestings: [{ amount: '10.00', date: '2026-02-01T00:00:00.000Z' }],
      }).vestings
    ).toEqual([{ amount: '10', date: '2026-02-01' }]);
  });

  it.each([null, 'not-an-array', { 0: 'not-an-array' }])(
    'rejects malformed present DAML vestings container %p',
    (vestings) => {
      expect(() =>
        damlEquityCompensationIssuanceDataToNative({
          ...ledgerIssuanceBase,
          compensation_type: 'OcfCompensationTypeRSU',
          exercise_price: null,
          base_price: null,
          vestings,
        })
      ).toThrow();
    }
  );

  it('rejects an accessor vesting without invoking its getter', () => {
    let getterReads = 0;
    const vestings: unknown[] = [];
    Object.defineProperty(vestings, '0', {
      configurable: true,
      enumerable: true,
      get() {
        getterReads += 1;
        return { amount: '10', date: '2026-02-01T00:00:00.000Z' };
      },
    });
    vestings.length = 1;

    expect(() =>
      damlEquityCompensationIssuanceDataToNative({
        ...ledgerIssuanceBase,
        compensation_type: 'OcfCompensationTypeRSU',
        exercise_price: null,
        base_price: null,
        vestings,
      })
    ).toThrow();
    expect(getterReads).toBe(0);
  });
});
