import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { OcpContractError, OcpParseError } from '../../src/errors';
import { readSingleContract } from '../../src/functions/OpenCapTable/shared/singleContractRead';

describe('readSingleContract', () => {
  it('forwards read scope and returns raw event details', async () => {
    const getEventsByContractId = jest.fn().mockResolvedValue({
      created: {
        createdEvent: {
          contractId: 'cid-123',
          templateId: '00deadbeef:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
          packageName: 'pkg-name',
          createArgument: { issuer_data: { id: 'issuer-1' } },
        },
      },
    });
    const client = { getEventsByContractId } as Pick<LedgerJsonApiClient, 'getEventsByContractId'> as LedgerJsonApiClient;

    const result = await readSingleContract(
      client,
      { contractId: 'cid-123', readAs: [] },
      {
        operation: 'getIssuerAsOcf',
        expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
      }
    );

    expect(getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'cid-123',
      readAs: [],
    });
    expect(result.createArgument).toEqual({ issuer_data: { id: 'issuer-1' } });
    expect(result.templateId).toBe('00deadbeef:Fairmint.OpenCapTable.OCF.Issuer:Issuer');
    expect(result.packageName).toBe('pkg-name');
    expect(result.templateIdentity).toMatchObject({
      moduleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
    });
    expect(result.createdEvent).toMatchObject({
      contractId: 'cid-123',
      packageName: 'pkg-name',
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
      readSingleContract(client, { contractId: 'cid-parse' }, { operation: 'getStakeholderAsOcf', missingDataError: 'parse' })
    ).rejects.toBeInstanceOf(OcpParseError);

    try {
      await readSingleContract(client, { contractId: 'cid-parse' }, { operation: 'getStakeholderAsOcf', missingDataError: 'parse' });
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
            createArgument: { issuer_data: { id: 'issuer-1' } },
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
      message: "Contract template identity is missing; cannot validate expected template",
      context: {
        contractId: 'cid-no-template',
        operation: 'getIssuerAsOcf',
        expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        expectedPackageName: 'pkg-name',
        expectedModuleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
      },
    });
  });
});
