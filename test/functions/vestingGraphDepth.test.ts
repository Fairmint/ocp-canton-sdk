import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpParseError, OcpValidationError } from '../../src/errors';
import { ENTITY_TEMPLATE_ID_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import {
  damlVestingTermsDataToNative,
  getVestingTermsAsOcf,
} from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';
import { findVestingGraphIssue } from '../../src/functions/OpenCapTable/vestingTerms/vestingGraphValidation';
import type { OcfVestingTerms, VestingCondition } from '../../src/types/native';

jest.setTimeout(30_000);

const DEEP_CHAIN_LENGTH = 5_000;
const BOUNDED_STRESS_LENGTH = 20_000;

function makeChain(length: number, relativeToRoot = false): OcfVestingTerms {
  const conditions = Array.from({ length }, (_, index): VestingCondition => {
    const id = `condition-${index}`;
    return {
      id,
      quantity: '1',
      trigger:
        index === 0
          ? { type: 'VESTING_START_DATE' }
          : {
              type: 'VESTING_SCHEDULE_RELATIVE',
              relative_to_condition_id: relativeToRoot ? 'condition-0' : `condition-${index - 1}`,
              period: { type: 'DAYS', length: 0, occurrences: 1 },
            },
      next_condition_ids: index + 1 < length ? [`condition-${index + 1}`] : [],
    };
  });

  return {
    object_type: 'VESTING_TERMS',
    id: '',
    name: '',
    description: '',
    allocation_type: 'CUMULATIVE_ROUNDING',
    vesting_conditions: conditions as OcfVestingTerms['vesting_conditions'],
    comments: [''],
  };
}

function makeGrandparentChain(length: number): OcfVestingTerms {
  const terms = makeChain(length);
  for (let index = 2; index < terms.vesting_conditions.length; index += 1) {
    const condition = terms.vesting_conditions[index];
    if (condition === undefined) continue;
    condition.trigger = {
      type: 'VESTING_SCHEDULE_RELATIVE',
      relative_to_condition_id: `condition-${index - 2}`,
      period: { type: 'DAYS', length: 0, occurrences: 1 },
    };
  }
  return terms;
}

function withDeepCycle(damlData: Record<string, unknown>): Record<string, unknown> {
  const conditions = (damlData.vesting_conditions as Array<Record<string, unknown>>).map((condition) => ({
    ...condition,
    next_condition_ids: [...(condition.next_condition_ids as string[])],
  }));
  const last = conditions[conditions.length - 1];
  if (last === undefined) throw new Error('Missing deep vesting condition');
  last.next_condition_ids = ['condition-0'];
  return { ...damlData, vesting_conditions: conditions };
}

function ledgerClient(damlData: Record<string, unknown>): LedgerJsonApiClient {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: 'deep-vesting-contract',
          templateId: ENTITY_TEMPLATE_ID_MAP.vestingTerms,
          createArgument: {
            context: { issuer: 'issuer::party', system_operator: 'operator::party' },
            vesting_terms_data: damlData,
          },
        },
      },
    }),
  } as unknown as LedgerJsonApiClient;
}

describe('deep vesting graph boundaries', () => {
  const nativeChain = makeChain(DEEP_CHAIN_LENGTH);
  let damlChain: Record<string, unknown>;
  let cyclicDamlChain: Record<string, unknown>;

  beforeAll(() => {
    damlChain = vestingTermsDataToDaml(nativeChain);
    cyclicDamlChain = withDeepCycle(damlChain);
  });

  it('validates 20k far-root relative references without recursion or repeated predecessor walks', () => {
    expect(findVestingGraphIssue(makeChain(BOUNDED_STRESS_LENGTH, true).vesting_conditions)).toBeUndefined();
  });

  it('stops distinct-target traversals after each grandchild query is reached', () => {
    expect(findVestingGraphIssue(makeGrandparentChain(BOUNDED_STRESS_LENGTH).vesting_conditions)).toBeUndefined();
  });

  it('preserves independent roots through the writer and direct reader', () => {
    const independent = makeChain(2);
    const first = independent.vesting_conditions[0];
    const second = independent.vesting_conditions[1];
    if (second === undefined) throw new Error('Missing second independent-root fixture');
    first.next_condition_ids = [];
    second.trigger = { type: 'VESTING_START_DATE' };
    const daml = vestingTermsDataToDaml(independent);
    expect(damlVestingTermsDataToNative(daml as never).vesting_conditions).toHaveLength(2);
  });

  it('writes a 5k chain without overflowing and preserves empty text plus zero-length periods', () => {
    expect((damlChain.vesting_conditions as unknown[]).length).toBe(DEEP_CHAIN_LENGTH);
    expect(damlChain).toMatchObject({ id: '', name: '', description: '', comments: [''] });
    expect((damlChain.vesting_conditions as Array<Record<string, unknown>>)[1]).toMatchObject({
      trigger: { value: { period: { value: { length_: '0' } } } },
    });
  });

  it('reads a direct 5k DAML chain without overflowing', () => {
    expect(damlVestingTermsDataToNative(damlChain as never).vesting_conditions).toHaveLength(DEEP_CHAIN_LENGTH);
  });

  it('dispatches a 5k DAML chain without overflowing', () => {
    expect(convertToOcf('vestingTerms', damlChain as never).vesting_conditions).toHaveLength(DEEP_CHAIN_LENGTH);
  });

  it('reads a 5k full ledger wrapper without overflowing', async () => {
    await expect(
      getVestingTermsAsOcf(ledgerClient(damlChain), { contractId: 'deep-vesting-contract' })
    ).resolves.toMatchObject({
      contractId: 'deep-vesting-contract',
      event: { id: '', name: '', description: '', comments: [''] },
    });
  });

  it('reports the exact deep cycle edge at the writer boundary', () => {
    const cyclic = makeChain(DEEP_CHAIN_LENGTH);
    const last = cyclic.vesting_conditions[DEEP_CHAIN_LENGTH - 1];
    if (last === undefined) throw new Error('Missing deep vesting condition');
    last.next_condition_ids = ['condition-0'];
    expect(() => vestingTermsDataToDaml(cyclic)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        fieldPath: `vestingTerms.vesting_conditions[${DEEP_CHAIN_LENGTH - 1}].next_condition_ids[0]`,
      })
    );
  });

  it('reports the exact deep cycle edge at the direct reader boundary', () => {
    expect(() => damlVestingTermsDataToNative(cyclicDamlChain as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        source: `vestingTerms.vesting_conditions[${DEEP_CHAIN_LENGTH - 1}].next_condition_ids[0]`,
      })
    );
  });

  it('reports the exact deep cycle edge at the dispatcher boundary', () => {
    expect(() => convertToOcf('vestingTerms', cyclicDamlChain as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        source: `vestingTerms.vesting_conditions[${DEEP_CHAIN_LENGTH - 1}].next_condition_ids[0]`,
      })
    );
  });

  it('reports the exact deep cycle edge at the ledger-reader boundary', async () => {
    await expect(
      getVestingTermsAsOcf(ledgerClient(cyclicDamlChain), { contractId: 'deep-vesting-contract' })
    ).rejects.toMatchObject({
      name: OcpParseError.name,
      source: `vestingTerms.vesting_conditions[${DEEP_CHAIN_LENGTH - 1}].next_condition_ids[0]`,
    });
  });

  it('reports an invalid allocation before a simultaneous graph cycle on every surface', async () => {
    const invalidWriterInput = makeChain(2);
    (invalidWriterInput as unknown as Record<string, unknown>).allocation_type = 'FUTURE_ALLOCATION';
    const lastWriterCondition = invalidWriterInput.vesting_conditions[1];
    if (lastWriterCondition === undefined) throw new Error('Missing mixed-invalid writer condition');
    lastWriterCondition.next_condition_ids = ['condition-0'];

    const validDaml = vestingTermsDataToDaml(makeChain(2));
    const invalidDaml = withDeepCycle(validDaml);
    invalidDaml.allocation_type = 'FutureAllocation';

    const actions: ReadonlyArray<() => unknown> = [
      () => vestingTermsDataToDaml(invalidWriterInput),
      () => convertToDaml('vestingTerms', invalidWriterInput),
      () => damlVestingTermsDataToNative(invalidDaml as never),
      () => convertToOcf('vestingTerms', invalidDaml as never),
      async () => getVestingTermsAsOcf(ledgerClient(invalidDaml), { contractId: 'deep-vesting-contract' }),
    ];

    for (const action of actions) {
      try {
        await action();
        throw new Error('Expected mixed-invalid vesting terms to fail');
      } catch (error) {
        expect(error).not.toMatchObject({ classification: 'invalid_vesting_graph' });
        expect(JSON.stringify(error)).toContain('allocation_type');
      }
    }
  });
});
