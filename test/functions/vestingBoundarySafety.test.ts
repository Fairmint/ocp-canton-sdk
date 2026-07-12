import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import { ENTITY_TEMPLATE_ID_MAP } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { extractAndDecodeDamlEntityData } from '../../src/functions/OpenCapTable/capTable/damlEntityData';
import { convertToOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { PLAIN_DATA_LIMITS } from '../../src/functions/OpenCapTable/shared/plainDataValidation';
import { damlVestingStartToNative } from '../../src/functions/OpenCapTable/vestingStart/damlToOcf';
import { getVestingStartAsOcf } from '../../src/functions/OpenCapTable/vestingStart/getVestingStartAsOcf';
import { vestingStartDataToDaml } from '../../src/functions/OpenCapTable/vestingStart/vestingStartDataToDaml';
import { vestingTermsDataToDaml } from '../../src/functions/OpenCapTable/vestingTerms/createVestingTerms';
import { damlVestingTermsDataToNative } from '../../src/functions/OpenCapTable/vestingTerms/getVestingTermsAsOcf';

const VALID_START_DATA = {
  id: 'vesting-start',
  date: '2026-07-10T00:00:00.000Z',
  security_id: 'security',
  vesting_condition_id: 'condition',
  comments: [],
} as const;

const CONTEXT = { issuer: 'issuer::party', system_operator: 'operator::party' } as const;

function expectBoundedSerializableDiagnostics(error: unknown): void {
  expect(error).toBeInstanceOf(OcpParseError);
  const parseError = error as OcpParseError;
  const serialized = JSON.stringify({
    name: parseError.name,
    message: parseError.message,
    code: parseError.code,
    source: parseError.source,
    context: parseError.context,
  });
  expect(serialized.length).toBeLessThanOrEqual(4_096);
  expect(JSON.parse(serialized)).toMatchObject({ name: OcpParseError.name });
}

describe('vesting boundary trap safety', () => {
  it('rejects a direct writer accessor without invoking it', () => {
    let reads = 0;
    const input = {
      object_type: 'TX_VESTING_START',
      date: '2026-07-10',
      security_id: 'security',
      vesting_condition_id: 'condition',
    } as Record<string, unknown>;
    Object.defineProperty(input, 'id', {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error('writer accessor executed');
      },
    });

    expect(() => vestingStartDataToDaml(input as never)).toThrow(
      expect.objectContaining({ name: OcpValidationError.name, fieldPath: 'vestingStart.id' })
    );
    expect(reads).toBe(0);
  });

  it('rejects a dispatcher writer accessor without invoking it', () => {
    let reads = 0;
    const input = {
      object_type: 'TX_VESTING_START',
      date: '2026-07-10',
      security_id: 'security',
      vesting_condition_id: 'condition',
    } as Record<string, unknown>;
    Object.defineProperty(input, 'id', {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error('dispatcher writer accessor executed');
      },
    });

    expect(() => convertToDaml('vestingStart', input as never)).toThrow(
      expect.objectContaining({ name: OcpValidationError.name, fieldPath: 'vestingStart.id' })
    );
    expect(reads).toBe(0);
  });

  it('rejects a nested VestingTerms writer accessor without invoking it', () => {
    let reads = 0;
    const condition = {
      id: 'condition',
      trigger: { type: 'VESTING_START_DATE' },
      next_condition_ids: [],
    } as Record<string, unknown>;
    Object.defineProperty(condition, 'quantity', {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error('nested writer accessor executed');
      },
    });
    const input = {
      object_type: 'VESTING_TERMS',
      id: 'terms',
      name: 'Terms',
      description: 'Accessor fixture',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [condition],
    };

    expect(() => vestingTermsDataToDaml(input as never)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        fieldPath: 'vestingTerms.vesting_conditions[0].quantity',
      })
    );
    expect(reads).toBe(0);
  });

  it('rejects a nested VestingTerms dispatcher accessor without invoking it', () => {
    let reads = 0;
    const condition = {
      id: 'condition',
      trigger: { type: 'VESTING_START_DATE' },
      next_condition_ids: [],
    } as Record<string, unknown>;
    Object.defineProperty(condition, 'quantity', {
      enumerable: true,
      get: () => {
        reads += 1;
        throw new Error('nested dispatcher writer accessor executed');
      },
    });
    const input = {
      object_type: 'VESTING_TERMS',
      id: 'terms',
      name: 'Terms',
      description: 'Accessor fixture',
      allocation_type: 'CUMULATIVE_ROUNDING',
      vesting_conditions: [condition],
    };

    expect(() => convertToDaml('vestingTerms', input as never)).toThrow(
      expect.objectContaining({
        name: OcpValidationError.name,
        fieldPath: 'vestingTerms.vesting_conditions[0].quantity',
      })
    );
    expect(reads).toBe(0);
  });

  it('rejects direct and dispatcher DAML proxies without invoking traps', () => {
    let traps = 0;
    const proxy = new Proxy(
      { ...VALID_START_DATA },
      {
        get: () => {
          traps += 1;
          throw new Error('get trap executed');
        },
        getOwnPropertyDescriptor: () => {
          traps += 1;
          throw new Error('descriptor trap executed');
        },
        getPrototypeOf: () => {
          traps += 1;
          throw new Error('prototype trap executed');
        },
        ownKeys: () => {
          traps += 1;
          throw new Error('ownKeys trap executed');
        },
      }
    );

    expect(() => damlVestingStartToNative(proxy as never)).toThrow(OcpParseError);
    expect(() => convertToOcf('vestingStart', proxy as never)).toThrow(OcpParseError);
    expect(traps).toBe(0);
  });

  it('rejects a revoked full wrapper before touching it', () => {
    const revoked = Proxy.revocable(
      { context: CONTEXT, vesting_data: { ...VALID_START_DATA } },
      {
        get: () => {
          throw new Error('revoked-wrapper get trap executed');
        },
      }
    );
    revoked.revoke();

    expect(() => extractAndDecodeDamlEntityData('vestingStart', revoked.proxy as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        source: 'damlToOcf.vestingStart.createArgument',
        context: expect.objectContaining({ decoderPath: 'input', issueKind: 'proxy' }),
      })
    );
  });

  it('rejects a legacy wrapper alias even when canonical data is present', () => {
    expect(() =>
      extractAndDecodeDamlEntityData('vestingStart', {
        context: CONTEXT,
        vesting_data: { ...VALID_START_DATA },
        vesting_start_data: { ...VALID_START_DATA },
      })
    ).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        context: expect.objectContaining({ decoderPath: 'input.vesting_start_data' }),
      })
    );
  });

  it('rejects a revoked ledger wrapper without invoking it', async () => {
    const revoked = Proxy.revocable({ context: CONTEXT, vesting_data: { ...VALID_START_DATA } }, {});
    revoked.revoke();
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'revoked-wrapper',
            templateId: ENTITY_TEMPLATE_ID_MAP.vestingStart,
            createArgument: revoked.proxy,
          },
        },
      }),
    } as unknown as LedgerJsonApiClient;

    await expect(getVestingStartAsOcf(client, { contractId: 'revoked-wrapper' })).rejects.toBeInstanceOf(OcpParseError);
  });

  it('returns bounded serializable diagnostics for cyclic DAML data', () => {
    const cyclic = { ...VALID_START_DATA } as Record<string, unknown>;
    cyclic.self = cyclic;
    try {
      damlVestingStartToNative(cyclic as never);
      throw new Error('Expected cyclic vesting data to fail');
    } catch (error) {
      expectBoundedSerializableDiagnostics(error);
    }
  });

  it('rejects a huge sparse nested list with bounded diagnostics', () => {
    const sparseComments = new Array<string>(1_000_000_000);
    const data = {
      id: 'terms',
      allocation_type: 'OcfAllocationCumulativeRounding',
      description: 'Sparse-list fixture',
      name: 'Terms',
      comments: sparseComments,
      vesting_conditions: [
        {
          id: 'condition',
          description: null,
          quantity: '1',
          portion: null,
          trigger: { tag: 'OcfVestingStartTrigger', value: {} },
          next_condition_ids: [],
        },
      ],
    };

    try {
      damlVestingTermsDataToNative(data as never);
      throw new Error('Expected sparse vesting comments to fail');
    } catch (error) {
      expectBoundedSerializableDiagnostics(error);
    }
  });

  it('rejects a payload deeper than the codec safety limit at its exact path', () => {
    let nested: unknown = 'leaf';
    for (let depth = 0; depth < PLAIN_DATA_LIMITS.maxDepth; depth += 1) nested = { x: nested };
    const expectedPath = `vestingStart.nested${'.x'.repeat(PLAIN_DATA_LIMITS.maxDepth)}`;

    expect(() => damlVestingStartToNative({ ...VALID_START_DATA, nested } as never)).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.OUT_OF_RANGE,
        source: expectedPath,
        context: expect.objectContaining({ issueKind: 'too-deep' }),
      })
    );
  });

  it('rejects an oversized dense list before a generated codec can traverse it', () => {
    const comments = Array.from({ length: PLAIN_DATA_LIMITS.maxArrayLength + 1 }, () => 'comment');
    expect(() => damlVestingStartToNative({ ...VALID_START_DATA, comments })).toThrow(
      expect.objectContaining({
        name: OcpParseError.name,
        code: OcpErrorCodes.OUT_OF_RANGE,
        source: 'vestingStart.comments.length',
        context: expect.objectContaining({ issueKind: 'too-large' }),
      })
    );
  });
});
