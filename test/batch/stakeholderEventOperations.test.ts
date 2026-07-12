import { CapTableBatch } from '../../src/functions/OpenCapTable/capTable/CapTableBatch';
import {
  ENTITY_TAG_MAP,
  type OcfCreateArguments,
  type OcfCreateOperation,
  type OcfDataTypeFor,
  type OcfEditOperation,
  type OcfEntityType,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import {
  buildOcfCreateData,
  buildOcfCreateDataFromOperation,
  buildOcfEditData,
  buildOcfEditDataFromOperation,
} from '../../src/functions/OpenCapTable/capTable/generatedBatchOperations';
import { convertOperationToDaml, convertToDaml } from '../../src/functions/OpenCapTable/capTable/ocfToDaml';
import { stakeholderRelationshipChangeEventDataToDaml } from '../../src/functions/OpenCapTable/stakeholderRelationshipChangeEvent/stakeholderRelationshipChangeEventDataToDaml';
import { stakeholderStatusChangeEventDataToDaml } from '../../src/functions/OpenCapTable/stakeholderStatusChangeEvent/stakeholderStatusChangeEventDataToDaml';
import type {
  OcfStakeholderRelationshipChangeEvent,
  OcfStakeholderStatusChangeEvent,
  StakeholderStatus,
} from '../../src/types/native';

type StakeholderEventType = Extract<
  OcfEntityType,
  'stakeholderRelationshipChangeEvent' | 'stakeholderStatusChangeEvent'
>;

interface StakeholderEventCase {
  readonly label: string;
  readonly entityType: StakeholderEventType;
  readonly data: OcfDataTypeFor<StakeholderEventType>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly createTag: 'OcfCreateStakeholderRelationshipChangeEvent' | 'OcfCreateStakeholderStatusChangeEvent';
  readonly editTag: 'OcfEditStakeholderRelationshipChangeEvent' | 'OcfEditStakeholderStatusChangeEvent';
}

const comments = ['', 'duplicate', 'duplicate'] as const;

const relationshipCases = [
  {
    label: 'started-only',
    data: {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      relationship_started: 'ADVISOR',
      comments: [...comments],
    },
    expectedRelationships: {
      relationship_started: 'OcfRelAdvisor',
      relationship_ended: null,
    },
  },
  {
    label: 'ended-only',
    data: {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      relationship_ended: 'EX_EMPLOYEE',
      comments: [...comments],
    },
    expectedRelationships: {
      relationship_started: null,
      relationship_ended: 'OcfRelExEmployee',
    },
  },
  {
    label: 'started-and-ended',
    data: {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      relationship_started: 'BOARD_MEMBER',
      relationship_ended: 'CONSULTANT',
      comments: [...comments],
    },
    expectedRelationships: {
      relationship_started: 'OcfRelBoardMember',
      relationship_ended: 'OcfRelConsultant',
    },
  },
  {
    label: 'same-started-and-ended',
    data: {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      relationship_started: 'OTHER',
      relationship_ended: 'OTHER',
      comments: [...comments],
    },
    expectedRelationships: {
      relationship_started: 'OcfRelOther',
      relationship_ended: 'OcfRelOther',
    },
  },
] as const satisfies ReadonlyArray<{
  readonly label: string;
  readonly data: OcfStakeholderRelationshipChangeEvent;
  readonly expectedRelationships: Readonly<Record<string, unknown>>;
}>;

const statusCases = [
  ['ACTIVE', 'OcfStakeholderStatusActive'],
  ['LEAVE_OF_ABSENCE', 'OcfStakeholderStatusLeaveOfAbsence'],
  ['TERMINATION_VOLUNTARY_OTHER', 'OcfStakeholderStatusTerminationVoluntaryOther'],
  ['TERMINATION_VOLUNTARY_GOOD_CAUSE', 'OcfStakeholderStatusTerminationVoluntaryGoodCause'],
  ['TERMINATION_VOLUNTARY_RETIREMENT', 'OcfStakeholderStatusTerminationVoluntaryRetirement'],
  ['TERMINATION_INVOLUNTARY_OTHER', 'OcfStakeholderStatusTerminationInvoluntaryOther'],
  ['TERMINATION_INVOLUNTARY_DEATH', 'OcfStakeholderStatusTerminationInvoluntaryDeath'],
  ['TERMINATION_INVOLUNTARY_DISABILITY', 'OcfStakeholderStatusTerminationInvoluntaryDisability'],
  ['TERMINATION_INVOLUNTARY_WITH_CAUSE', 'OcfStakeholderStatusTerminationInvoluntaryWithCause'],
] as const satisfies ReadonlyArray<readonly [StakeholderStatus, string]>;

const stakeholderEventCases: readonly StakeholderEventCase[] = [
  ...relationshipCases.map(({ label, data, expectedRelationships }) => ({
    label: `relationship ${label}`,
    entityType: 'stakeholderRelationshipChangeEvent' as const,
    data,
    expected: {
      id: '',
      date: '2026-07-10T00:00:00.000Z',
      stakeholder_id: '',
      comments: [...comments],
      ...expectedRelationships,
    },
    createTag: 'OcfCreateStakeholderRelationshipChangeEvent' as const,
    editTag: 'OcfEditStakeholderRelationshipChangeEvent' as const,
  })),
  ...statusCases.map(([status, damlStatus]) => ({
    label: `status ${status}`,
    entityType: 'stakeholderStatusChangeEvent' as const,
    data: {
      object_type: 'CE_STAKEHOLDER_STATUS' as const,
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      new_status: status,
      comments: [...comments],
    } satisfies OcfStakeholderStatusChangeEvent,
    expected: {
      id: '',
      date: '2026-07-10T00:00:00.000Z',
      stakeholder_id: '',
      new_status: damlStatus,
      comments: [...comments],
    },
    createTag: 'OcfCreateStakeholderStatusChangeEvent' as const,
    editTag: 'OcfEditStakeholderStatusChangeEvent' as const,
  })),
];

function argsFor(testCase: StakeholderEventCase): OcfCreateArguments {
  return [testCase.entityType, testCase.data] as OcfCreateArguments;
}

function createOperationFor(testCase: StakeholderEventCase): OcfCreateOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfCreateOperation;
}

function editOperationFor(testCase: StakeholderEventCase): OcfEditOperation {
  return { type: testCase.entityType, data: testCase.data } as OcfEditOperation;
}

function directWriter(testCase: StakeholderEventCase): unknown {
  return testCase.entityType === 'stakeholderRelationshipChangeEvent'
    ? stakeholderRelationshipChangeEventDataToDaml(
        testCase.data as OcfDataTypeFor<'stakeholderRelationshipChangeEvent'>
      )
    : stakeholderStatusChangeEventDataToDaml(testCase.data as OcfDataTypeFor<'stakeholderStatusChangeEvent'>);
}

describe('stakeholder event operation boundaries', () => {
  it.each(stakeholderEventCases)(
    '$label preserves canonical values and exact generated tags through every path',
    (testCase) => {
      const args = argsFor(testCase);
      const createOperation = createOperationFor(testCase);
      const editOperation = editOperationFor(testCase);
      const create = buildOcfCreateData(...args);
      const createFromOperation = buildOcfCreateDataFromOperation(createOperation);
      const edit = buildOcfEditData(...args);
      const editFromOperation = buildOcfEditDataFromOperation(editOperation);

      for (const damlData of [
        directWriter(testCase),
        convertToDaml(...args),
        convertOperationToDaml(createOperation),
        create.value,
        createFromOperation.value,
        edit.value,
        editFromOperation.value,
      ]) {
        expect(damlData).toEqual(testCase.expected);
      }

      expect(ENTITY_TAG_MAP[testCase.entityType]).toMatchObject({
        create: testCase.createTag,
        edit: testCase.editTag,
      });
      expect(create.tag).toBe(testCase.createTag);
      expect(createFromOperation.tag).toBe(testCase.createTag);
      expect(edit.tag).toBe(testCase.editTag);
      expect(editFromOperation.tag).toBe(testCase.editTag);

      const batch = new CapTableBatch({ capTableContractId: 'cap-table-stakeholder-events', actAs: ['issuer::party'] });
      batch.create(...args).editOperation(editOperation);
      const { command } = batch.build();
      if (!('ExerciseCommand' in command)) throw new Error('Expected an ExerciseCommand');
      const choiceArgument = command.ExerciseCommand.choiceArgument as {
        creates: Array<{ tag: string; value: unknown }>;
        edits: Array<{ tag: string; value: unknown }>;
      };
      expect(choiceArgument.creates).toEqual([{ tag: testCase.createTag, value: testCase.expected }]);
      expect(choiceArgument.edits).toEqual([{ tag: testCase.editTag, value: testCase.expected }]);
    }
  );
});
