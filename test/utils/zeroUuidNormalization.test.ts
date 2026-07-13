import { normalizeZeroUuidSentinels, ZERO_UUID } from '../../src/utils/zeroUuidNormalization';

describe('normalizeZeroUuidSentinels', () => {
  it('omits exact sentinel properties recursively without mutating input', () => {
    const input = {
      vesting_terms_id: ZERO_UUID,
      nested: {
        optional_reference_id: ZERO_UUID,
        retained_reference_id: 'd877fc0f-d875-418f-b7e5-599bf9c6c86c',
      },
    };

    expect(normalizeZeroUuidSentinels(input)).toEqual({
      nested: {
        retained_reference_id: 'd877fc0f-d875-418f-b7e5-599bf9c6c86c',
      },
    });
    expect(input.vesting_terms_id).toBe(ZERO_UUID);
    expect(input.nested.optional_reference_id).toBe(ZERO_UUID);
  });

  it('preserves array positions so sentinel entries remain schema-invalid', () => {
    const input = [
      ZERO_UUID,
      {
        optional_reference_id: ZERO_UUID,
        retained_reference_id: '847db196-2b14-451e-89e7-7e71ba099f67',
      },
    ];
    const normalized = normalizeZeroUuidSentinels(input);

    expect(normalized).toHaveLength(2);
    expect(normalized).toEqual([
      undefined,
      {
        retained_reference_id: '847db196-2b14-451e-89e7-7e71ba099f67',
      },
    ]);
  });

  it('leaves every nonzero UUID and unrelated string unchanged', () => {
    const input = {
      id: '18de005e-6683-4aa6-9d28-b7f87c408365',
      description: `prefix-${ZERO_UUID}`,
      references: ['847db196-2b14-451e-89e7-7e71ba099f67'],
    };

    const normalized = normalizeZeroUuidSentinels(input);

    expect(normalized).toBe(input);
    expect((normalized as typeof input).references).toBe(input.references);
  });
});
