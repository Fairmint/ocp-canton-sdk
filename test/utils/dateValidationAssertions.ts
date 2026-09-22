import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';

export function expectInvalidDate(
  action: () => unknown,
  fieldPath: string,
  receivedValue: unknown,
  code: OcpErrorCode = OcpErrorCodes.INVALID_FORMAT
): void {
  let thrown: unknown;

  expect(() => {
    try {
      action();
    } catch (error) {
      thrown = error;
      throw error;
    }
  }).toThrow(OcpValidationError);

  expect(thrown).toMatchObject({ code, fieldPath, receivedValue });
}
