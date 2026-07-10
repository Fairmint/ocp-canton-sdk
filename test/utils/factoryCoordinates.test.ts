import { OcpErrorCodes, OcpValidationError } from '../../src/errors';
import { hasCompleteFactoryCoordinates, validateFactoryCoordinates } from '../../src/utils/factoryCoordinates';

describe('factory coordinate validation', () => {
  test.each([
    { contractId: 'factory-cid', templateId: 'factory-template' },
    { contractId: ' factory-cid ', templateId: ' factory-template ' },
  ])('accepts complete non-blank coordinates', (factory) => {
    expect(hasCompleteFactoryCoordinates(factory)).toBe(true);
    expect(() => validateFactoryCoordinates(factory)).not.toThrow();
  });

  test.each([
    null,
    'factory-cid',
    {},
    { contractId: 'factory-cid' },
    { templateId: 'factory-template' },
    { contractId: '', templateId: 'factory-template' },
    { contractId: 'factory-cid', templateId: '   ' },
    { contractId: 123, templateId: 'factory-template' },
  ])('rejects incomplete or malformed coordinates: %p', (factory) => {
    expect(hasCompleteFactoryCoordinates(factory)).toBe(false);

    try {
      validateFactoryCoordinates(factory);
      throw new Error('Expected factory coordinate validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpValidationError);
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_FORMAT,
        fieldPath: 'factory',
        receivedValue: factory,
      });
    }
  });

  test('treats an omitted override as valid', () => {
    expect(hasCompleteFactoryCoordinates(undefined)).toBe(false);
    expect(() => validateFactoryCoordinates(undefined)).not.toThrow();
  });
});
