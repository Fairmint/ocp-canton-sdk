import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { equityCompensationIssuanceDataToDaml } from '../../src/functions/OpenCapTable/equityCompensationIssuance/createEquityCompensationIssuance';
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
});

describe('equity compensation Monetary exactness', () => {
  const ocfIssuanceBase = {
    object_type: 'TX_EQUITY_COMPENSATION_ISSUANCE' as const,
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

  const pricingVariants = [
    {
      compensationType: 'OPTION' as const,
      damlCompensationType: 'OcfCompensationTypeOption',
      priceField: 'exercise_price' as const,
    },
    {
      compensationType: 'OPTION_ISO' as const,
      damlCompensationType: 'OcfCompensationTypeOptionISO',
      priceField: 'exercise_price' as const,
    },
    {
      compensationType: 'OPTION_NSO' as const,
      damlCompensationType: 'OcfCompensationTypeOptionNSO',
      priceField: 'exercise_price' as const,
    },
    {
      compensationType: 'CSAR' as const,
      damlCompensationType: 'OcfCompensationTypeCSAR',
      priceField: 'base_price' as const,
    },
    {
      compensationType: 'SSAR' as const,
      damlCompensationType: 'OcfCompensationTypeSSAR',
      priceField: 'base_price' as const,
    },
    {
      compensationType: 'RSU' as const,
      damlCompensationType: 'OcfCompensationTypeRSU',
      priceField: null,
    },
  ];

  function writerInput(
    compensationType: (typeof pricingVariants)[number]['compensationType'],
    priceField: 'exercise_price' | 'base_price' | null,
    price?: unknown
  ): Parameters<typeof equityCompensationIssuanceDataToDaml>[0] {
    return {
      ...ocfIssuanceBase,
      compensation_type: compensationType,
      ...(priceField === null ? {} : { [priceField]: price }),
    } as unknown as Parameters<typeof equityCompensationIssuanceDataToDaml>[0];
  }

  function ledgerInput(
    damlCompensationType: string,
    priceField: 'exercise_price' | 'base_price' | null,
    price?: unknown
  ): Record<string, unknown> {
    return {
      ...ledgerIssuanceBase,
      compensation_type: damlCompensationType,
      exercise_price: priceField === 'exercise_price' ? price : null,
      base_price: priceField === 'base_price' ? price : null,
    };
  }

  function expectPricingError(action: () => unknown, fieldPath: string, code: string): void {
    try {
      action();
      throw new Error('Expected pricing validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({ fieldPath, code });
    }
  }

  it.each(pricingVariants)(
    'round-trips canonical Numeric(10) pricing for $compensationType',
    ({ compensationType, damlCompensationType, priceField }) => {
      const price = { amount: '+0001.1234567891', currency: 'USD' };
      const daml = equityCompensationIssuanceDataToDaml(writerInput(compensationType, priceField, price));
      const native = damlEquityCompensationIssuanceDataToNative(daml);

      expect(daml.compensation_type).toBe(damlCompensationType);
      expect(native.compensation_type).toBe(compensationType);
      if (priceField === null) {
        expect(native).not.toHaveProperty('exercise_price');
        expect(native).not.toHaveProperty('base_price');
      } else {
        expect(daml[priceField]).toEqual({ amount: '1.1234567891', currency: 'USD' });
        expect(native[priceField]).toEqual({ amount: '1.1234567891', currency: 'USD' });
      }
    }
  );

  const malformedPrices = [
    {
      name: 'eleven decimal places',
      value: { amount: '1.12345678901', currency: 'USD' },
      pathSuffix: '.amount',
      writerCode: OcpErrorCodes.INVALID_FORMAT,
      readerCode: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'twenty-nine integer digits',
      value: { amount: '1'.repeat(29), currency: 'USD' },
      pathSuffix: '.amount',
      writerCode: OcpErrorCodes.INVALID_FORMAT,
      readerCode: OcpErrorCodes.INVALID_FORMAT,
    },
    ...['US', 'usd', 'US1'].map((currency) => ({
      name: `currency ${currency}`,
      value: { amount: '1', currency },
      pathSuffix: '.currency',
      writerCode: OcpErrorCodes.INVALID_FORMAT,
      readerCode: OcpErrorCodes.INVALID_FORMAT,
    })),
    {
      name: 'an unknown field',
      value: { amount: '1', currency: 'USD', unexpected: true },
      pathSuffix: '.unexpected',
      writerCode: OcpErrorCodes.INVALID_FORMAT,
      readerCode: OcpErrorCodes.INVALID_FORMAT,
    },
    {
      name: 'a missing amount',
      value: { currency: 'USD' },
      pathSuffix: '.amount',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    },
    {
      name: 'a missing currency',
      value: { amount: '1' },
      pathSuffix: '.currency',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.REQUIRED_FIELD_MISSING,
    },
    {
      name: 'a numeric amount',
      value: { amount: 1, currency: 'USD' },
      pathSuffix: '.amount',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.INVALID_TYPE,
    },
    {
      name: 'a boolean',
      value: false,
      pathSuffix: '',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.INVALID_TYPE,
    },
    {
      name: 'an array',
      value: [],
      pathSuffix: '',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.INVALID_TYPE,
    },
    {
      name: 'a string',
      value: '',
      pathSuffix: '',
      writerCode: OcpErrorCodes.INVALID_TYPE,
      readerCode: OcpErrorCodes.INVALID_TYPE,
    },
  ];

  const pricedBoundaryVariants = pricingVariants.filter(
    (variant): variant is (typeof pricingVariants)[number] & { priceField: 'exercise_price' | 'base_price' } =>
      variant.compensationType === 'OPTION' || variant.compensationType === 'CSAR'
  );
  const malformedBoundaryCases = pricedBoundaryVariants.flatMap((variant) =>
    malformedPrices.map((malformed) => ({ ...variant, ...malformed }))
  );

  it.each(malformedBoundaryCases)(
    'direct writer rejects $name for $compensationType at the exact price path',
    ({ compensationType, priceField, value, pathSuffix, writerCode }) => {
      expectPricingError(
        () => equityCompensationIssuanceDataToDaml(writerInput(compensationType, priceField, value)),
        `equityCompensationIssuance.${priceField}${pathSuffix}`,
        writerCode
      );
    }
  );

  it.each(malformedBoundaryCases)(
    'ledger reader rejects $name for $compensationType at the exact price path',
    ({ damlCompensationType, priceField, value, pathSuffix, readerCode }) => {
      expectPricingError(
        () => damlEquityCompensationIssuanceDataToNative(ledgerInput(damlCompensationType, priceField, value)),
        `equityCompensationIssuance.${priceField}${pathSuffix}`,
        readerCode
      );
    }
  );

  it('rejects OCF exponent notation but accepts and canonicalizes generated DAML exponent notation', () => {
    expectPricingError(
      () =>
        equityCompensationIssuanceDataToDaml(
          writerInput('OPTION', 'exercise_price', { amount: '1.23e2', currency: 'USD' })
        ),
      'equityCompensationIssuance.exercise_price.amount',
      OcpErrorCodes.INVALID_FORMAT
    );

    expect(
      damlEquityCompensationIssuanceDataToNative(
        ledgerInput('OcfCompensationTypeOption', 'exercise_price', {
          amount: '1.23e2',
          currency: 'USD',
        })
      ).exercise_price
    ).toEqual({ amount: '123', currency: 'USD' });
  });
});
