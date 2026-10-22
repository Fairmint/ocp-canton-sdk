import { OcpErrorCodes, OcpParseError, OcpValidationError, type OcpErrorCode } from '../../src/errors';

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

/**
 * A Daml `Date` read from the ledger is only ever an exact `YYYY-MM-DD`; anything else is a schema mismatch at the
 * field that carried it.
 */
export function expectInvalidDamlDate(action: () => unknown, source: string, receivedValue: unknown): void {
  let thrown: unknown;

  expect(() => {
    try {
      action();
    } catch (error) {
      thrown = error;
      throw error;
    }
  }).toThrow(OcpParseError);

  expect(thrown).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    source,
    context: { expectedType: 'Daml Date (YYYY-MM-DD)', receivedValue },
  });
}
