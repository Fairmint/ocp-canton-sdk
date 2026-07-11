/** Direct ledger-reader contracts for stakeholder change events. */

import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpErrorCodes, OcpParseError, OcpValidationError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_FALLBACK_MAP,
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { convertToOcf, getEntityAsOcf } from '../../src/functions/OpenCapTable/capTable/damlToOcf';
import { convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { damlStakeholderRelationshipChangeEventToNative } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/damlToOcf';
import { getStakeholderRelationshipChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/getStakeholderRelationshipChangeEventAsOcf';
import { stakeholderRelationshipChangeEventDataToDaml } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import { getStakeholderStatusChangeEventAsOcf } from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/getStakeholderStatusChangeEventAsOcf';
import { OcpClient } from '../../src/OcpClient';
import {
  STAKEHOLDER_RELATIONSHIP_TYPES,
  type OcfStakeholderRelationshipChangeEvent,
  type OcfStakeholderStatusChangeEvent,
} from '../../src/types/native';
import { stakeholderRelationshipTypeToDaml } from '../../src/utils/enumConversions';

type StakeholderEventEntityType = Extract<
  OcfEntityType,
  'stakeholderRelationshipChangeEvent' | 'stakeholderStatusChangeEvent'
>;

type StakeholderEvent = OcfStakeholderRelationshipChangeEvent | OcfStakeholderStatusChangeEvent;

const VALID_CONTEXT = {
  issuer: 'issuer::party',
  system_operator: 'system-operator::party',
} as const;

interface StakeholderEventReaderCase {
  readonly entityType: StakeholderEventEntityType;
  readonly contractId: string;
  readonly legacyDataField: 'relationship_change_data' | 'status_change_data';
  readonly validData: () => Record<string, unknown>;
  readonly expectedEvent: StakeholderEvent;
  readonly invoke: (
    client: LedgerJsonApiClient,
    readAs?: string[]
  ) => Promise<{ readonly event: StakeholderEvent; readonly contractId: string }>;
}

function relationshipData(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'relationship-event-1',
    date: '2026-07-10T00:00:00.000Z',
    stakeholder_id: 'stakeholder-1',
    comments: ['promoted to advisor'],
    relationship_started: 'OcfRelAdvisor',
    relationship_ended: null,
    ...overrides,
  };
}

function statusData(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'status-event-1',
    date: '2026-07-10T00:00:00.000Z',
    stakeholder_id: 'stakeholder-1',
    comments: ['returned from leave'],
    new_status: 'OcfStakeholderStatusActive',
    ...overrides,
  };
}

const relationshipCase: StakeholderEventReaderCase = {
  entityType: 'stakeholderRelationshipChangeEvent',
  contractId: 'relationship-event-cid',
  legacyDataField: 'relationship_change_data',
  validData: relationshipData,
  expectedEvent: {
    object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
    id: 'relationship-event-1',
    date: '2026-07-10',
    stakeholder_id: 'stakeholder-1',
    comments: ['promoted to advisor'],
    relationship_started: 'ADVISOR',
  },
  invoke: async (client, readAs) =>
    getStakeholderRelationshipChangeEventAsOcf(client, {
      contractId: 'relationship-event-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const statusCase: StakeholderEventReaderCase = {
  entityType: 'stakeholderStatusChangeEvent',
  contractId: 'status-event-cid',
  legacyDataField: 'status_change_data',
  validData: statusData,
  expectedEvent: {
    object_type: 'CE_STAKEHOLDER_STATUS',
    id: 'status-event-1',
    date: '2026-07-10',
    stakeholder_id: 'stakeholder-1',
    comments: ['returned from leave'],
    new_status: 'ACTIVE',
  },
  invoke: async (client, readAs) =>
    getStakeholderStatusChangeEventAsOcf(client, {
      contractId: 'status-event-cid',
      ...(readAs !== undefined ? { readAs } : {}),
    }),
};

const stakeholderEventCases = [relationshipCase, statusCase] as const;

function createMockClient(
  testCase: StakeholderEventReaderCase,
  data: unknown,
  options: {
    readonly createArgument?: unknown;
    /** Null deliberately omits ledger template identity. */
    readonly templateId?: string | null;
  } = {}
): { readonly client: LedgerJsonApiClient; readonly getEventsByContractId: jest.Mock } {
  const createArgument = Object.prototype.hasOwnProperty.call(options, 'createArgument')
    ? options.createArgument
    : { context: VALID_CONTEXT, [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: data };
  const templateId =
    options.templateId === undefined ? ENTITY_TEMPLATE_ID_MAP[testCase.entityType] : options.templateId;
  const getEventsByContractId = jest.fn().mockResolvedValue({
    created: {
      createdEvent: {
        contractId: testCase.contractId,
        ...(templateId !== null ? { templateId } : {}),
        createArgument,
      },
    },
  });

  return {
    client: { getEventsByContractId } as unknown as LedgerJsonApiClient,
    getEventsByContractId,
  };
}

function expectDecoderFailure(error: unknown, testCase: StakeholderEventReaderCase, field: string): void {
  expect(error).toBeInstanceOf(OcpParseError);
  expect(error).toMatchObject({
    code: OcpErrorCodes.SCHEMA_MISMATCH,
    context: {
      entityType: testCase.entityType,
      decoderPath: expect.any(String),
      decoderMessage: expect.any(String),
    },
  });
  const parseError = error as OcpParseError;
  expect(`${String(parseError.context?.decoderPath)} ${String(parseError.context?.decoderMessage)}`).toContain(field);
}

async function expectDecoderRejection(
  testCase: StakeholderEventReaderCase,
  data: unknown,
  field: string
): Promise<void> {
  const { client } = createMockClient(testCase, data);
  try {
    await testCase.invoke(client);
    throw new Error(`Expected ${testCase.entityType} reader to reject malformed ${field}`);
  } catch (error: unknown) {
    expectDecoderFailure(error, testCase, field);
  }
}

function withoutField(data: Record<string, unknown>, field: string): Record<string, unknown> {
  delete data[field];
  return data;
}

describe('decoder-backed stakeholder event readers', () => {
  it('registers both readers with only the canonical event_data field', () => {
    expect(ENTITY_DATA_FIELD_MAP.stakeholderRelationshipChangeEvent).toBe('event_data');
    expect(ENTITY_DATA_FIELD_MAP.stakeholderStatusChangeEvent).toBe('event_data');
    expect(
      Object.prototype.hasOwnProperty.call(ENTITY_DATA_FIELD_FALLBACK_MAP, 'stakeholderRelationshipChangeEvent')
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(ENTITY_DATA_FIELD_FALLBACK_MAP, 'stakeholderStatusChangeEvent')).toBe(
      false
    );
  });

  it.each(stakeholderEventCases)(
    '$entityType returns its exact canonical event and forwards readAs',
    async (testCase) => {
      const { client, getEventsByContractId } = createMockClient(testCase, testCase.validData());

      await expect(testCase.invoke(client, ['issuer::reader'])).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
      expect(getEventsByContractId).toHaveBeenCalledWith({
        contractId: testCase.contractId,
        readAs: ['issuer::reader'],
      });
    }
  );

  it.each(stakeholderEventCases)(
    '$entityType uses only canonical event_data when top-level fields look valid',
    async (testCase) => {
      const canonicalData = testCase.validData();
      const { client } = createMockClient(testCase, canonicalData, {
        createArgument: {
          ...canonicalData,
          id: 'wrong-top-level-id',
          event_data: canonicalData,
        },
      });

      await expect(testCase.invoke(client)).resolves.toEqual({
        event: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(stakeholderEventCases)(
    'getEntityAsOcf reads canonical $entityType data with its exact public result',
    async (testCase) => {
      const { client } = createMockClient(testCase, testCase.validData());

      await expect(
        getEntityAsOcf(client, testCase.entityType, testCase.contractId, { readAs: ['issuer::generic-reader'] })
      ).resolves.toEqual({
        data: testCase.expectedEvent,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(stakeholderEventCases)('$entityType rejects a missing canonical wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { createArgument: {} });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining('event_data'),
    });
  });

  it.each(stakeholderEventCases)('$entityType rejects non-object canonical data', async (testCase) => {
    const { client } = createMockClient(testCase, []);

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining('event_data'),
    });
  });

  it.each(stakeholderEventCases)('$entityType rejects its legacy wrapper', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), {
      createArgument: { [testCase.legacyDataField]: testCase.validData() },
    });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      message: expect.stringContaining('event_data'),
    });
  });

  it.each(stakeholderEventCases)('$entityType rejects a missing ledger template identity', async (testCase) => {
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: null });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'missing_template_id',
      contractId: testCase.contractId,
      context: { expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType] },
    });
  });

  it.each(stakeholderEventCases)('$entityType rejects a contract from the wrong template', async (testCase) => {
    const wrongTemplateId = ENTITY_TEMPLATE_ID_MAP.document;
    const { client } = createMockClient(testCase, testCase.validData(), { templateId: wrongTemplateId });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'module_entity_mismatch',
      contractId: testCase.contractId,
      templateId: wrongTemplateId,
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
        actualTemplateId: wrongTemplateId,
      },
    });
  });

  it.each(stakeholderEventCases)('$entityType rejects malformed transaction ids', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), id: 17 }, 'id');
  });

  it.each(stakeholderEventCases)('$entityType rejects missing transaction ids', async (testCase) => {
    await expectDecoderRejection(testCase, withoutField(testCase.validData(), 'id'), 'id');
  });

  it.each(stakeholderEventCases)('$entityType rejects malformed transaction dates', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), date: 17 }, 'date');
  });

  it.each(stakeholderEventCases)('$entityType rejects missing transaction dates', async (testCase) => {
    await expectDecoderRejection(testCase, withoutField(testCase.validData(), 'date'), 'date');
  });

  it.each(stakeholderEventCases)('$entityType rejects malformed stakeholder ids', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), stakeholder_id: 17 }, 'stakeholder_id');
  });

  it.each(stakeholderEventCases)('$entityType rejects missing stakeholder ids', async (testCase) => {
    await expectDecoderRejection(testCase, withoutField(testCase.validData(), 'stakeholder_id'), 'stakeholder_id');
  });

  it.each(stakeholderEventCases)('$entityType rejects malformed comments', async (testCase) => {
    await expectDecoderRejection(testCase, { ...testCase.validData(), comments: ['valid', 17] }, 'comments');
  });

  it.each(stakeholderEventCases)('$entityType rejects a missing required comments list', async (testCase) => {
    await expectDecoderRejection(testCase, withoutField(testCase.validData(), 'comments'), 'comments');
  });

  it.each(stakeholderEventCases)('$entityType rejects semantically invalid transaction dates', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), date: '2026-99-99' });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      fieldPath: `${testCase.entityType}.date`,
    });
  });

  it.each(stakeholderEventCases)('$entityType omits empty comments canonically', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), comments: [] });
    const result = await testCase.invoke(client);

    expect(result.event.comments).toBeUndefined();
    expect('comments' in result.event).toBe(false);
  });

  it.each(stakeholderEventCases)('$entityType rejects fields discarded by the generated codec', async (testCase) => {
    const { client } = createMockClient(testCase, { ...testCase.validData(), unexpected_field: true });

    await expect(testCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      context: {
        entityType: testCase.entityType,
        decoderPath: 'input.unexpected_field',
        decoderMessage: 'raw field was discarded by the generated codec',
      },
    });
  });
});

describe('stakeholder relationship change semantics', () => {
  it.each(STAKEHOLDER_RELATIONSHIP_TYPES)(
    'preserves canonical relationship %s through direct, generic, namespace, and object-type reads',
    async (relationship) => {
      const damlRelationship = stakeholderRelationshipTypeToDaml(relationship);
      const data = relationshipData({ relationship_started: damlRelationship, relationship_ended: null });
      const expected = { ...relationshipCase.expectedEvent, relationship_started: relationship };

      expect(
        damlStakeholderRelationshipChangeEventToNative(
          data as unknown as Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0]
        )
      ).toEqual(expected);
      expect(
        convertToOcf(
          'stakeholderRelationshipChangeEvent',
          data as unknown as Parameters<typeof damlStakeholderRelationshipChangeEventToNative>[0]
        )
      ).toEqual(expected);

      const { client } = createMockClient(relationshipCase, data);
      await expect(getEntityAsOcf(client, relationshipCase.entityType, relationshipCase.contractId)).resolves.toEqual({
        data: expected,
        contractId: relationshipCase.contractId,
      });

      const ocp = new OcpClient({ ledger: client });
      await expect(
        ocp.OpenCapTable.stakeholderRelationshipChangeEvent.get({ contractId: relationshipCase.contractId })
      ).resolves.toEqual({ data: expected, contractId: relationshipCase.contractId });
      await expect(
        ocp.OpenCapTable.getByObjectType({
          objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
          contractId: relationshipCase.contractId,
        })
      ).resolves.toEqual({ data: expected, contractId: relationshipCase.contractId });
    }
  );

  it.each(STAKEHOLDER_RELATIONSHIP_TYPES)('writes canonical relationship %s without alias coercion', (relationship) => {
    const result = stakeholderRelationshipChangeEventDataToDaml({
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: 'relationship-write',
      date: '2026-07-10',
      stakeholder_id: 'stakeholder-1',
      relationship_started: relationship,
    });

    expect(result.relationship_started).toBe(stakeholderRelationshipTypeToDaml(relationship));
    expect(result.relationship_ended).toBeNull();
  });

  it.each([
    [{}, OcpErrorCodes.REQUIRED_FIELD_MISSING, 'stakeholderRelationshipChangeEvent'],
    [
      { relationship_started: null },
      OcpErrorCodes.INVALID_TYPE,
      'stakeholderRelationshipChangeEvent.relationship_started',
    ],
    [
      { relationship_started: 'advisor' },
      OcpErrorCodes.INVALID_FORMAT,
      'stakeholderRelationshipChangeEvent.relationship_started',
    ],
  ] as const)('rejects invalid direct relationship writer input %j', (overrides, code, fieldPath) => {
    const input = {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: 'relationship-write-invalid',
      date: '2026-07-10',
      stakeholder_id: 'stakeholder-1',
      ...overrides,
    };

    const write = () =>
      stakeholderRelationshipChangeEventDataToDaml(input as unknown as OcfStakeholderRelationshipChangeEvent);
    expect(write).toThrow(OcpValidationError);
    try {
      write();
    } catch (error) {
      expect(error).toMatchObject({ code, fieldPath });
    }
  });

  it.each([
    ['relationship_started', null],
    ['relationship_started', 7],
    ['relationship_ended', null],
    ['relationship_ended', 7],
  ] as const)('rejects non-string %s through the typed write dispatcher', (field, value) => {
    const input = {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: 'relationship-dispatch-invalid',
      date: '2026-07-10',
      stakeholder_id: 'stakeholder-1',
      [field]: value,
    };

    const write = () =>
      convertToDaml('stakeholderRelationshipChangeEvent', input as unknown as OcfStakeholderRelationshipChangeEvent);
    expect(write).toThrow(OcpValidationError);
    try {
      write();
    } catch (error) {
      expect(error).toMatchObject({
        code: OcpErrorCodes.INVALID_TYPE,
        fieldPath: `stakeholderRelationshipChangeEvent.${field}`,
        receivedValue: value,
      });
    }
  });

  it('reads a started-only relationship change', async () => {
    const { client } = createMockClient(relationshipCase, relationshipData());

    await expect(relationshipCase.invoke(client)).resolves.toEqual({
      event: relationshipCase.expectedEvent,
      contractId: relationshipCase.contractId,
    });
  });

  it('accepts a valid relationship when the other generated Optional key is omitted', async () => {
    const data = relationshipData();
    delete data.relationship_ended;
    const { client } = createMockClient(relationshipCase, data);

    await expect(relationshipCase.invoke(client)).resolves.toEqual({
      event: relationshipCase.expectedEvent,
      contractId: relationshipCase.contractId,
    });
  });

  it('reads an ended-only relationship change', async () => {
    const { client } = createMockClient(
      relationshipCase,
      relationshipData({ relationship_started: null, relationship_ended: 'OcfRelEmployee' })
    );

    await expect(relationshipCase.invoke(client)).resolves.toEqual({
      event: {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'relationship-event-1',
        date: '2026-07-10',
        stakeholder_id: 'stakeholder-1',
        comments: ['promoted to advisor'],
        relationship_ended: 'EMPLOYEE',
      },
      contractId: relationshipCase.contractId,
    });
  });

  it('reads a relationship change with both started and ended values', async () => {
    const { client } = createMockClient(
      relationshipCase,
      relationshipData({ relationship_started: 'OcfRelAdvisor', relationship_ended: 'OcfRelEmployee' })
    );

    await expect(relationshipCase.invoke(client)).resolves.toEqual({
      event: {
        object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
        id: 'relationship-event-1',
        date: '2026-07-10',
        stakeholder_id: 'stakeholder-1',
        comments: ['promoted to advisor'],
        relationship_started: 'ADVISOR',
        relationship_ended: 'EMPLOYEE',
      },
      contractId: relationshipCase.contractId,
    });
  });

  it('rejects a relationship change whose generated optionals are both null', async () => {
    const { client } = createMockClient(
      relationshipCase,
      relationshipData({ relationship_started: null, relationship_ended: null })
    );

    await expect(relationshipCase.invoke(client)).rejects.toBeInstanceOf(OcpValidationError);
    await expect(relationshipCase.invoke(client)).rejects.toMatchObject({
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'stakeholderRelationshipChangeEvent',
    });
  });

  it('defaults omitted generated optionals to null and still rejects the empty semantic change', async () => {
    const data = relationshipData();
    delete data.relationship_started;
    delete data.relationship_ended;
    const { client } = createMockClient(relationshipCase, data);

    await expect(relationshipCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.REQUIRED_FIELD_MISSING,
      fieldPath: 'stakeholderRelationshipChangeEvent',
    });
  });

  it.each(['relationship_started', 'relationship_ended'] as const)('rejects an invalid %s enum', async (field) => {
    await expectDecoderRejection(relationshipCase, relationshipData({ [field]: 'OcfRelDefinitelyUnknown' }), field);
  });

  it.each(['relationship_started', 'relationship_ended'] as const)(
    'losslessly rejects a malformed object that the generated %s Optional defaults to null',
    async (field) => {
      const { client } = createMockClient(relationshipCase, relationshipData({ [field]: { tag: 'invalid' } }));

      await expect(relationshipCase.invoke(client)).rejects.toMatchObject({
        name: 'OcpParseError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        context: {
          entityType: relationshipCase.entityType,
          decoderPath: `input.${field}`,
          decoderMessage: 'raw object was decoded and encoded as null',
        },
      });
    }
  );
});

describe('stakeholder status mapping', () => {
  it.each([
    ['OcfStakeholderStatusActive', 'ACTIVE'],
    ['OcfStakeholderStatusLeaveOfAbsence', 'LEAVE_OF_ABSENCE'],
    ['OcfStakeholderStatusTerminationVoluntaryOther', 'TERMINATION_VOLUNTARY_OTHER'],
    ['OcfStakeholderStatusTerminationVoluntaryGoodCause', 'TERMINATION_VOLUNTARY_GOOD_CAUSE'],
    ['OcfStakeholderStatusTerminationVoluntaryRetirement', 'TERMINATION_VOLUNTARY_RETIREMENT'],
    ['OcfStakeholderStatusTerminationInvoluntaryOther', 'TERMINATION_INVOLUNTARY_OTHER'],
    ['OcfStakeholderStatusTerminationInvoluntaryDeath', 'TERMINATION_INVOLUNTARY_DEATH'],
    ['OcfStakeholderStatusTerminationInvoluntaryDisability', 'TERMINATION_INVOLUNTARY_DISABILITY'],
    ['OcfStakeholderStatusTerminationInvoluntaryWithCause', 'TERMINATION_INVOLUNTARY_WITH_CAUSE'],
  ] as const)('maps %s to %s', async (damlStatus, nativeStatus) => {
    const { client } = createMockClient(statusCase, statusData({ new_status: damlStatus }));
    const result = await statusCase.invoke(client);

    expect(result.event).toMatchObject({
      object_type: 'CE_STAKEHOLDER_STATUS',
      new_status: nativeStatus,
    });
  });

  it('rejects an invalid generated status enum', async () => {
    await expectDecoderRejection(
      statusCase,
      statusData({ new_status: 'OcfStakeholderStatusDefinitelyUnknown' }),
      'new_status'
    );
  });

  it('rejects a missing new_status field directly at the generated boundary', async () => {
    await expectDecoderRejection(statusCase, withoutField(statusData(), 'new_status'), 'new_status');
  });
});

describe('same-wrapper stakeholder event isolation', () => {
  it('rejects status event data under the relationship template and reader', async () => {
    await expectDecoderRejection(relationshipCase, statusData(), 'new_status');
  });

  it('rejects relationship event data under the status template and reader', async () => {
    await expectDecoderRejection(statusCase, relationshipData(), 'new_status');
  });

  it('rejects a relationship payload carrying the status template identity', async () => {
    const { client } = createMockClient(relationshipCase, relationshipData(), {
      templateId: ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent,
    });

    await expect(relationshipCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      classification: 'module_entity_mismatch',
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent,
        actualTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent,
      },
    });
  });

  it('rejects a status payload carrying the relationship template identity', async () => {
    const { client } = createMockClient(statusCase, statusData(), {
      templateId: ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent,
    });

    await expect(statusCase.invoke(client)).rejects.toMatchObject({
      name: 'OcpContractError',
      classification: 'module_entity_mismatch',
      context: {
        expectedTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent,
        actualTemplateId: ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent,
      },
    });
  });
});
