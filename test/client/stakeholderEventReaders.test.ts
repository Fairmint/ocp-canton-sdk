import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpClient } from '../../src/OcpClient';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../src/errors';
import {
  ENTITY_DATA_FIELD_MAP,
  ENTITY_TEMPLATE_ID_MAP,
  type DamlDataTypeFor,
} from '../../src/functions/OpenCapTable/capTable/batchTypes';
import type { OcfStakeholderRelationshipChangeEvent, OcfStakeholderStatusChangeEvent } from '../../src/types/native';
import { createLedgerJsonApiClient } from '../utils/cantonNodeSdkCompat';

type ClientReaderCase =
  | {
      readonly entityType: 'stakeholderRelationshipChangeEvent';
      readonly objectType: 'CE_STAKEHOLDER_RELATIONSHIP';
      readonly contractId: string;
      readonly data: DamlDataTypeFor<'stakeholderRelationshipChangeEvent'>;
      readonly expected: OcfStakeholderRelationshipChangeEvent;
    }
  | {
      readonly entityType: 'stakeholderStatusChangeEvent';
      readonly objectType: 'CE_STAKEHOLDER_STATUS';
      readonly contractId: string;
      readonly data: DamlDataTypeFor<'stakeholderStatusChangeEvent'>;
      readonly expected: OcfStakeholderStatusChangeEvent;
    };

const clientReaderCases = [
  {
    entityType: 'stakeholderRelationshipChangeEvent',
    objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
    contractId: 'client-relationship-event',
    data: {
      id: '',
      date: '2026-07-10T00:00:00.000Z',
      stakeholder_id: '',
      relationship_started: 'OcfRelOther',
      relationship_ended: 'OcfRelOther',
      comments: ['', 'duplicate', 'duplicate'],
    },
    expected: {
      object_type: 'CE_STAKEHOLDER_RELATIONSHIP',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      relationship_started: 'OTHER',
      relationship_ended: 'OTHER',
      comments: ['', 'duplicate', 'duplicate'],
    },
  },
  {
    entityType: 'stakeholderStatusChangeEvent',
    objectType: 'CE_STAKEHOLDER_STATUS',
    contractId: 'client-status-event',
    data: {
      id: '',
      date: '2026-07-10T00:00:00.000Z',
      stakeholder_id: '',
      new_status: 'OcfStakeholderStatusTerminationInvoluntaryWithCause',
      comments: ['', 'duplicate', 'duplicate'],
    },
    expected: {
      object_type: 'CE_STAKEHOLDER_STATUS',
      id: '',
      date: '2026-07-10',
      stakeholder_id: '',
      new_status: 'TERMINATION_INVOLUNTARY_WITH_CAUSE',
      comments: ['', 'duplicate', 'duplicate'],
    },
  },
] as const satisfies readonly ClientReaderCase[];

interface LedgerOverrides {
  readonly contractId?: string;
  /** `null` deliberately omits the ledger template identity. */
  readonly templateId?: string | null;
}

function ledgerFor(testCase: ClientReaderCase, overrides: LedgerOverrides = {}): LedgerJsonApiClient {
  const ledger = createLedgerJsonApiClient({ network: 'devnet' });
  Object.defineProperty(ledger, 'getEventsByContractId', {
    value: jest.fn(async () => {
      await Promise.resolve();
      const templateId =
        overrides.templateId === undefined ? ENTITY_TEMPLATE_ID_MAP[testCase.entityType] : overrides.templateId;
      return {
        created: {
          createdEvent: {
            contractId: overrides.contractId ?? testCase.contractId,
            ...(templateId !== null ? { templateId } : {}),
            createArgument: {
              context: { issuer: 'issuer::party', system_operator: 'system-operator::party' },
              [ENTITY_DATA_FIELD_MAP[testCase.entityType]]: testCase.data,
            },
          },
        },
      };
    }),
    configurable: true,
    enumerable: true,
    writable: true,
  });
  return ledger;
}

async function namespaceRead(ocp: OcpClient, testCase: ClientReaderCase) {
  return testCase.entityType === 'stakeholderRelationshipChangeEvent'
    ? ocp.OpenCapTable.stakeholderRelationshipChangeEvent.get({ contractId: testCase.contractId })
    : ocp.OpenCapTable.stakeholderStatusChangeEvent.get({ contractId: testCase.contractId });
}

async function objectTypeRead(ocp: OcpClient, testCase: ClientReaderCase) {
  return testCase.objectType === 'CE_STAKEHOLDER_RELATIONSHIP'
    ? ocp.OpenCapTable.getByObjectType({
        objectType: 'CE_STAKEHOLDER_RELATIONSHIP',
        contractId: testCase.contractId,
      })
    : ocp.OpenCapTable.getByObjectType({
        objectType: 'CE_STAKEHOLDER_STATUS',
        contractId: testCase.contractId,
      });
}

async function captureRejection(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected action to reject');
}

describe('OcpClient stakeholder event readers', () => {
  it.each(clientReaderCases)(
    '$entityType has runtime parity across its typed namespace and object_type reader',
    async (testCase) => {
      const ocp = new OcpClient({ ledger: ledgerFor(testCase) });

      await expect(namespaceRead(ocp, testCase)).resolves.toEqual({
        data: testCase.expected,
        contractId: testCase.contractId,
      });
      await expect(objectTypeRead(ocp, testCase)).resolves.toEqual({
        data: testCase.expected,
        contractId: testCase.contractId,
      });
    }
  );

  it.each(clientReaderCases)(
    '$entityType rejects the other same-wrapper event template at both client surfaces',
    async (testCase) => {
      const wrongTemplateId =
        testCase.entityType === 'stakeholderRelationshipChangeEvent'
          ? ENTITY_TEMPLATE_ID_MAP.stakeholderStatusChangeEvent
          : ENTITY_TEMPLATE_ID_MAP.stakeholderRelationshipChangeEvent;
      const ocp = new OcpClient({ ledger: ledgerFor(testCase, { templateId: wrongTemplateId }) });

      for (const read of [async () => namespaceRead(ocp, testCase), async () => objectTypeRead(ocp, testCase)]) {
        const error = await captureRejection(read);
        expect(error).toBeInstanceOf(OcpContractError);
        const contractError = error as OcpContractError;
        expect(contractError.code).toBe(OcpErrorCodes.SCHEMA_MISMATCH);
        expect(contractError.classification).toBe('module_entity_mismatch');
        expect(contractError.contractId).toBe(testCase.contractId);
        expect(contractError.templateId).toBe(wrongTemplateId);
        expect(contractError.context).toMatchObject({
          expectedTemplateId: ENTITY_TEMPLATE_ID_MAP[testCase.entityType],
          actualTemplateId: wrongTemplateId,
        });
      }
    }
  );

  it.each(clientReaderCases)('$entityType rejects ledger results whose contract identity changed', async (testCase) => {
    const returnedContractId = `${testCase.contractId}-wrong`;
    const ocp = new OcpClient({ ledger: ledgerFor(testCase, { contractId: returnedContractId }) });

    for (const read of [async () => namespaceRead(ocp, testCase), async () => objectTypeRead(ocp, testCase)]) {
      const error = await captureRejection(read);
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe(OcpErrorCodes.INVALID_RESPONSE);
      expect(parseError.classification).toBe('created_event_contract_id_mismatch');
      expect(parseError.context).toMatchObject({
        actualContractId: returnedContractId,
        requestedContractId: testCase.contractId,
      });
    }
  });
});
