import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { validateEquityCompensationPricing } from '../../src/functions/OpenCapTable/equityCompensationIssuance/equityCompensationPricing';

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
