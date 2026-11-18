import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpErrorCodes, OcpParseError } from '../../src/errors';
import { ENTITY_REGISTRY } from '../../src/functions/OpenCapTable/capTable/batchTypes';
import { readSingleContract } from '../../src/functions/OpenCapTable/shared/singleContractRead';
import { packageIdForm } from '../register/registerLedgerFixtures';
import { TEST_REGISTER_CONTEXT, TEST_REGISTER_SIGNATORIES } from '../utils/registerEvents';

const ISSUER_TEMPLATE_ID = ENTITY_REGISTRY.issuer.templateId;

function clientReturning(
  createdEvent: Record<string, unknown>
): LedgerJsonApiClient & { getEventsByContractId: jest.Mock } {
  return {
    getEventsByContractId: jest.fn().mockResolvedValue({ created: { createdEvent } }),
  } as unknown as LedgerJsonApiClient & { getEventsByContractId: jest.Mock };
}

/** An issuer record's created event as the Ledger API returns it, with the register's three signatories. */
function issuerEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractId: 'cid-123',
    templateId: packageIdForm(ISSUER_TEMPLATE_ID),
    packageName: 'OpenCapTable-v35',
    signatories: TEST_REGISTER_SIGNATORIES,
    offset: 12,
    createArgument: { context: TEST_REGISTER_CONTEXT, ocf_data: { id: 'issuer-1' } },
    ...overrides,
  };
}

async function readIssuer(client: LedgerJsonApiClient) {
  return readSingleContract(
    client,
    { contractId: 'cid-123' },
    { operation: 'getIssuerAsOcf', expectedTemplateId: ISSUER_TEMPLATE_ID }
  );
}

describe('readSingleContract', () => {
  it('forwards read scope and returns raw event details', async () => {
    const client = clientReturning(issuerEvent());

    const result = await readSingleContract(
      client,
      { contractId: 'cid-123', readAs: [] },
      {
        operation: 'getIssuerAsOcf',
        expectedTemplateId: ISSUER_TEMPLATE_ID,
      }
    );

    expect(client.getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'cid-123',
      readAs: [],
    });
    expect(result.createArgument).toEqual({ context: TEST_REGISTER_CONTEXT, ocf_data: { id: 'issuer-1' } });
    expect(result.templateId).toBe(packageIdForm(ISSUER_TEMPLATE_ID));
    expect(result.packageName).toBe('OpenCapTable-v35');
    expect(result.templateIdentity).toMatchObject({
      moduleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
    });
    expect(result.createdEvent).toMatchObject({
      contractId: 'cid-123',
      packageName: 'OpenCapTable-v35',
    });
  });

  describe('register admission rules', () => {
    it('accepts the package name a #name: template ID carries', async () => {
      const { packageName: _name, ...event } = issuerEvent({ templateId: ISSUER_TEMPLATE_ID });

      await expect(readIssuer(clientReturning(event))).resolves.toMatchObject({ packageName: undefined });
    });

    function issuerEventWithout(field: string): Record<string, unknown> {
      const { [field]: _omitted, ...event } = issuerEvent();
      return event;
    }

    it.each([
      ['another package name', issuerEvent({ packageName: 'NotOpenCapTable' }), 'package_name_mismatch'],
      ['no package name with a package-ID template', issuerEventWithout('packageName'), 'register_wrong_package'],
      ['no signatories', issuerEventWithout('signatories'), 'register_invalid_event'],
    ] as const)('rejects %s', async (_case, event, classification) => {
      await expect(readIssuer(clientReturning(event))).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.SCHEMA_MISMATCH,
        classification,
      });
    });

    it.each([
      ['a fourth signatory', [...TEST_REGISTER_SIGNATORIES, 'intruder::party']],
      ['a missing signatory', TEST_REGISTER_SIGNATORIES.slice(1)],
      ['another party', [TEST_REGISTER_CONTEXT.issuer, TEST_REGISTER_CONTEXT.system_operator, 'intruder::party']],
    ])('rejects %s as an authorization failure', async (_case, signatories) => {
      await expect(readIssuer(clientReturning(issuerEvent({ signatories })))).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.AUTHORIZATION_FAILED,
        classification: 'register_wrong_signatories',
        contractId: 'cid-123',
      });
    });

    it('checks an interface view when the event carries one', async () => {
      const view = (viewValue: Record<string, unknown>) => ({
        interfaceViews: [
          {
            interfaceId: '0dfd:Fairmint.OpenCapTableApi.OcfObject:OcfObject',
            viewStatus: { code: 0, message: '' },
            viewValue: {
              cap_table_id: TEST_REGISTER_CONTEXT.cap_table_id,
              object_type: 'ISSUER',
              object_id: 'issuer-1',
              security_ids: [],
              ...viewValue,
            },
          },
        ],
      });

      await expect(readIssuer(clientReturning(issuerEvent(view({}))))).resolves.toBeDefined();
      await expect(readIssuer(clientReturning(issuerEvent(view({ object_id: 'other' }))))).rejects.toMatchObject({
        classification: 'register_record_mismatch',
      });
      await expect(readIssuer(clientReturning(issuerEvent(view({ cap_table_id: 'other' }))))).rejects.toMatchObject({
        classification: 'register_view_mismatch',
      });
    });

    it('leaves a context it cannot read to the caller’s decoding', async () => {
      const event = issuerEvent({ createArgument: { ocf_data: { id: 'issuer-1' } } });

      await expect(readIssuer(clientReturning(event))).resolves.toMatchObject({
        createArgument: { ocf_data: { id: 'issuer-1' } },
      });
    });

    it('applies no register rule to a template outside the register', async () => {
      const event = { templateId: '00ab:Other.Module:Template', createArgument: { anything: true } };

      await expect(
        readSingleContract(
          clientReturning(event),
          { contractId: 'cid-other' },
          { operation: 'readOther', expectedTemplateId: '#other-package:Other.Module:Template' }
        )
      ).resolves.toMatchObject({ createArgument: { anything: true } });
    });
  });

  it('throws contract error with structured diagnostics when created event is missing', async () => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({ created: null }),
    } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    await expect(
      readSingleContract(client, { contractId: 'cid-missing' }, { operation: 'getIssuerAsOcf' })
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: 'RESULT_NOT_FOUND',
      classification: 'missing_created_event',
      context: {
        contractId: 'cid-missing',
        operation: 'getIssuerAsOcf',
      },
    });
  });

  it('supports parse-mode missing data errors', async () => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'cid-parse',
          },
        },
      }),
    } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    await expect(
      readSingleContract(
        client,
        { contractId: 'cid-parse' },
        { operation: 'getStakeholderAsOcf', missingDataError: 'parse' }
      )
    ).rejects.toBeInstanceOf(OcpParseError);

    try {
      await readSingleContract(
        client,
        { contractId: 'cid-parse' },
        { operation: 'getStakeholderAsOcf', missingDataError: 'parse' }
      );
      throw new Error('expected readSingleContract to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpParseError);
      const parseError = error as OcpParseError;
      expect(parseError.code).toBe('INVALID_RESPONSE');
      expect(parseError.classification).toBe('missing_create_argument');
      expect(parseError.context).toMatchObject({
        contractId: 'cid-parse',
        operation: 'getStakeholderAsOcf',
      });
    }
  });

  it('throws structured template mismatch errors', async () => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'cid-mismatch',
            templateId: '#pkg-name:Fairmint.OpenCapTable.OCF.StockClass:StockClass',
            packageName: 'pkg-name',
            createArgument: { id: 'stock-class-1' },
          },
        },
      }),
    } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    await expect(
      readSingleContract(
        client,
        { contractId: 'cid-mismatch' },
        {
          operation: 'getIssuerAsOcf',
          expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        }
      )
    ).rejects.toBeInstanceOf(OcpContractError);
  });

  it('throws a typed error when expected template validation lacks ledger template identity', async () => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue({
        created: {
          createdEvent: {
            contractId: 'cid-no-template',
            createArgument: { ocf_data: { id: 'issuer-1' } },
          },
        },
      }),
    } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    await expect(
      readSingleContract(
        client,
        { contractId: 'cid-no-template' },
        {
          operation: 'getIssuerAsOcf',
          expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        }
      )
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: 'SCHEMA_MISMATCH',
      classification: 'missing_template_id',
      message: 'Contract template identity is missing; cannot validate expected template',
      context: {
        contractId: 'cid-no-template',
        operation: 'getIssuerAsOcf',
        expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        expectedPackageName: 'pkg-name',
        expectedModuleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
      },
    });
  });

  it.each([
    ['null', null],
    ['primitive number', 42],
    ['primitive string', 'not-an-object'],
    ['array', []],
  ])('throws structured parse error when ledger events response is %s', async (_desc, invalidResponse) => {
    const client = {
      getEventsByContractId: jest.fn().mockResolvedValue(invalidResponse),
    } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    await expect(
      readSingleContract(client, { contractId: 'cid-null' }, { operation: 'getIssuerAsOcf' })
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: 'INVALID_RESPONSE',
      classification: 'invalid_ledger_json',
      source: 'contract cid-null.eventsResponse',
      context: {
        contractId: 'cid-null',
        operation: 'getIssuerAsOcf',
        receivedValue: invalidResponse,
      },
    });
  });
});
