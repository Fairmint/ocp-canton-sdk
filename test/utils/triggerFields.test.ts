import { OcpErrorCodes, OcpValidationError, type OcpErrorCode } from '../../src/errors';
import {
  triggerFieldsFromDaml,
  triggerFieldsToDaml,
  type OcfTriggerDiscriminator,
} from '../../src/functions/OpenCapTable/shared/triggerFields';
import type { ConversionTriggerFieldShape } from '../../src/types/native';

const PATH = 'issuance.triggers[]';

function fieldsToDaml(type: OcfTriggerDiscriminator, input: Record<string, unknown>) {
  return triggerFieldsToDaml({ type, ...input } as ConversionTriggerFieldShape, PATH);
}

function expectTriggerFieldError(
  action: () => unknown,
  field: 'trigger_date' | 'trigger_condition' | 'start_date' | 'end_date',
  receivedValue: unknown,
  code: OcpErrorCode
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

  expect(thrown).toMatchObject({ code, fieldPath: `${PATH}.${field}`, receivedValue });
}

describe('trigger discriminator boundaries', () => {
  test('AUTOMATIC_ON_DATE requires and canonicalizes only trigger_date on write', () => {
    expect(fieldsToDaml('AUTOMATIC_ON_DATE', { trigger_date: '2024-01-15T23:30:00-05:00' })).toEqual({
      trigger_date: '2024-01-15T00:00:00.000Z',
      trigger_condition: null,
      start_date: null,
      end_date: null,
    });
  });

  test.each([
    [null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['', OcpErrorCodes.INVALID_FORMAT],
    [{ seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
  ] as const)('AUTOMATIC_ON_DATE rejects required trigger_date %p on write', (value, code) => {
    expectTriggerFieldError(
      () => fieldsToDaml('AUTOMATIC_ON_DATE', { trigger_date: value }),
      'trigger_date',
      value,
      code
    );
  });

  test('ELECTIVE_IN_RANGE requires and canonicalizes start_date and end_date on write', () => {
    expect(
      fieldsToDaml('ELECTIVE_IN_RANGE', {
        start_date: '2024-01-15T00:30:00+14:00',
        end_date: '2024-02-15T23:30:00-05:00',
      })
    ).toEqual({
      trigger_date: null,
      trigger_condition: null,
      start_date: '2024-01-15T00:00:00.000Z',
      end_date: '2024-02-15T00:00:00.000Z',
    });
  });

  test.each(['start_date', 'end_date'] as const)(
    'ELECTIVE_IN_RANGE rejects missing or malformed required %s on write',
    (field) => {
      for (const [value, code] of [
        [null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
        [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
        ['', OcpErrorCodes.INVALID_FORMAT],
        [{ seconds: 1 }, OcpErrorCodes.INVALID_TYPE],
      ] as const) {
        expectTriggerFieldError(
          () =>
            fieldsToDaml('ELECTIVE_IN_RANGE', {
              start_date: '2024-01-15',
              end_date: '2024-02-15',
              [field]: value,
            }),
          field,
          value,
          code
        );
      }
    }
  );

  test.each([
    ['AUTOMATIC_ON_DATE', 'start_date'],
    ['AUTOMATIC_ON_DATE', 'end_date'],
    ['ELECTIVE_IN_RANGE', 'trigger_date'],
    ['AUTOMATIC_ON_CONDITION', 'trigger_date'],
    ['ELECTIVE_AT_WILL', 'start_date'],
    ['ELECTIVE_ON_CONDITION', 'end_date'],
    ['UNSPECIFIED', 'trigger_date'],
  ] as const)('%s rejects forbidden %s on write, including explicit null', (type, field) => {
    for (const value of ['2024-01-15', null, undefined]) {
      const input =
        type === 'AUTOMATIC_ON_DATE'
          ? { trigger_date: '2024-01-15', [field]: value }
          : type === 'ELECTIVE_IN_RANGE'
            ? { start_date: '2024-01-15', end_date: '2024-02-15', [field]: value }
            : { [field]: value };
      expectTriggerFieldError(() => fieldsToDaml(type, input), field, value, OcpErrorCodes.INVALID_FORMAT);
    }
  });

  test.each(['AUTOMATIC_ON_CONDITION', 'ELECTIVE_ON_CONDITION'] as const)(
    '%s requires a Text trigger_condition on write',
    (type) => {
      expect(fieldsToDaml(type, { trigger_condition: 'condition' })).toEqual({
        trigger_date: null,
        trigger_condition: 'condition',
        start_date: null,
        end_date: null,
      });
      for (const [value, code] of [
        [null, OcpErrorCodes.REQUIRED_FIELD_MISSING],
        [undefined, OcpErrorCodes.REQUIRED_FIELD_MISSING],
        [{ condition: true }, OcpErrorCodes.INVALID_TYPE],
      ] as const) {
        expectTriggerFieldError(
          () => fieldsToDaml(type, { trigger_condition: value }),
          'trigger_condition',
          value,
          code
        );
      }
      expect(fieldsToDaml(type, { trigger_condition: '' }).trigger_condition).toBe('');
      expect(fieldsToDaml(type, { trigger_condition: '   ' }).trigger_condition).toBe('   ');
    }
  );

  test.each(['AUTOMATIC_ON_DATE', 'ELECTIVE_IN_RANGE', 'ELECTIVE_AT_WILL', 'UNSPECIFIED'] as const)(
    '%s rejects a forbidden trigger_condition on write',
    (type) => {
      const input =
        type === 'AUTOMATIC_ON_DATE'
          ? { trigger_date: '2024-01-15', trigger_condition: 'forbidden' }
          : type === 'ELECTIVE_IN_RANGE'
            ? { start_date: '2024-01-15', end_date: '2024-02-15', trigger_condition: 'forbidden' }
            : { trigger_condition: 'forbidden' };
      expectTriggerFieldError(
        () => fieldsToDaml(type, input),
        'trigger_condition',
        'forbidden',
        OcpErrorCodes.INVALID_FORMAT
      );
    }
  );

  test.each(['AUTOMATIC_ON_DATE', 'ELECTIVE_IN_RANGE', 'ELECTIVE_AT_WILL', 'UNSPECIFIED'] as const)(
    '%s rejects an explicitly present undefined forbidden field at runtime',
    (type) => {
      const requiredFields =
        type === 'AUTOMATIC_ON_DATE'
          ? { trigger_date: '2024-01-15' }
          : type === 'ELECTIVE_IN_RANGE'
            ? { start_date: '2024-01-15', end_date: '2024-02-15' }
            : {};
      expectTriggerFieldError(
        () => fieldsToDaml(type, { ...requiredFields, trigger_condition: undefined }),
        'trigger_condition',
        undefined,
        OcpErrorCodes.INVALID_FORMAT
      );
    }
  );

  test('field-free variants encode all discriminator optionals as null', () => {
    expect(fieldsToDaml('ELECTIVE_AT_WILL', {})).toEqual({
      trigger_date: null,
      trigger_condition: null,
      start_date: null,
      end_date: null,
    });
  });

  test('read-side AUTOMATIC_ON_DATE and ELECTIVE_IN_RANGE return only their schema fields', () => {
    expect(
      triggerFieldsFromDaml(
        { trigger_date: '2024-01-15T23:30:00-05:00', trigger_condition: null, start_date: null, end_date: null },
        'AUTOMATIC_ON_DATE',
        PATH
      )
    ).toEqual({ type: 'AUTOMATIC_ON_DATE', trigger_date: '2024-01-15' });
    expect(
      triggerFieldsFromDaml(
        {
          trigger_date: null,
          trigger_condition: null,
          start_date: '2024-01-15T00:00:00Z',
          end_date: '2024-02-15T00:00:00Z',
        },
        'ELECTIVE_IN_RANGE',
        PATH
      )
    ).toEqual({ type: 'ELECTIVE_IN_RANGE', start_date: '2024-01-15', end_date: '2024-02-15' });
  });

  test.each([
    ['AUTOMATIC_ON_DATE', 'trigger_date'],
    ['ELECTIVE_IN_RANGE', 'start_date'],
    ['ELECTIVE_IN_RANGE', 'end_date'],
  ] as const)('%s rejects missing required %s on read', (type, field) => {
    const input =
      type === 'AUTOMATIC_ON_DATE'
        ? { trigger_date: null, start_date: null, end_date: null }
        : { trigger_date: null, start_date: '2024-01-15', end_date: '2024-02-15', [field]: null };
    expectTriggerFieldError(
      () => triggerFieldsFromDaml(input, type, PATH),
      field,
      null,
      OcpErrorCodes.REQUIRED_FIELD_MISSING
    );
  });

  test.each([
    ['AUTOMATIC_ON_DATE', 'start_date'],
    ['AUTOMATIC_ON_DATE', 'end_date'],
    ['ELECTIVE_IN_RANGE', 'trigger_date'],
    ['AUTOMATIC_ON_CONDITION', 'trigger_date'],
    ['ELECTIVE_AT_WILL', 'start_date'],
    ['ELECTIVE_ON_CONDITION', 'end_date'],
    ['UNSPECIFIED', 'trigger_date'],
  ] as const)('%s rejects a populated forbidden %s on read', (type, field) => {
    const input =
      type === 'AUTOMATIC_ON_DATE'
        ? { trigger_date: '2024-01-15', start_date: null, end_date: null, [field]: '2024-02-15' }
        : type === 'ELECTIVE_IN_RANGE'
          ? {
              trigger_date: '2024-03-15',
              start_date: '2024-01-15',
              end_date: '2024-02-15',
            }
          : { trigger_date: null, start_date: null, end_date: null, [field]: '2024-01-15' };
    expectTriggerFieldError(
      () => triggerFieldsFromDaml(input, type, PATH),
      field,
      input[field],
      OcpErrorCodes.SCHEMA_MISMATCH
    );
  });

  test.each(['AUTOMATIC_ON_CONDITION', 'ELECTIVE_ON_CONDITION'] as const)(
    '%s requires and emits trigger_condition on read',
    (type) => {
      expect(
        triggerFieldsFromDaml(
          { trigger_date: null, trigger_condition: 'financing closes', start_date: null, end_date: null },
          type,
          PATH
        )
      ).toEqual({ type, trigger_condition: 'financing closes' });
      for (const [value, code] of [[null, OcpErrorCodes.REQUIRED_FIELD_MISSING]] as const) {
        expectTriggerFieldError(
          () =>
            triggerFieldsFromDaml(
              { trigger_date: null, trigger_condition: value, start_date: null, end_date: null },
              type,
              PATH
            ),
          'trigger_condition',
          value,
          code
        );
      }
      expect(
        triggerFieldsFromDaml(
          { trigger_date: null, trigger_condition: '', start_date: null, end_date: null },
          type,
          PATH
        )
      ).toEqual({ type, trigger_condition: '' });
      expect(
        triggerFieldsFromDaml(
          { trigger_date: null, trigger_condition: '   ', start_date: null, end_date: null },
          type,
          PATH
        )
      ).toEqual({ type, trigger_condition: '   ' });
    }
  );

  test.each(['AUTOMATIC_ON_DATE', 'ELECTIVE_IN_RANGE', 'ELECTIVE_AT_WILL', 'UNSPECIFIED'] as const)(
    '%s rejects a populated forbidden trigger_condition on read',
    (type) => {
      const input =
        type === 'AUTOMATIC_ON_DATE'
          ? { trigger_date: '2024-01-15', trigger_condition: 'forbidden', start_date: null, end_date: null }
          : type === 'ELECTIVE_IN_RANGE'
            ? {
                trigger_date: null,
                trigger_condition: 'forbidden',
                start_date: '2024-01-15',
                end_date: '2024-02-15',
              }
            : { trigger_date: null, trigger_condition: 'forbidden', start_date: null, end_date: null };
      expectTriggerFieldError(
        () => triggerFieldsFromDaml(input, type, PATH),
        'trigger_condition',
        'forbidden',
        OcpErrorCodes.SCHEMA_MISMATCH
      );
    }
  );

  test.each(['ELECTIVE_AT_WILL', 'UNSPECIFIED'] as const)(
    '%s accepts null DAML optionals and emits no discriminator properties',
    (type: OcfTriggerDiscriminator) => {
      expect(
        triggerFieldsFromDaml(
          { trigger_date: null, trigger_condition: null, start_date: null, end_date: null },
          type,
          PATH
        )
      ).toEqual({ type });
    }
  );
});
