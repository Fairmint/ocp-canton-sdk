import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import { createFactory } from '../../src/functions/OpenCapTable/factory/createFactory';
import { validateFactoryId, validateFactoryIdentity } from '../../src/functions/OpenCapTable/factory/factoryIdentity';
import { findFactory } from '../../src/functions/OpenCapTable/factory/findFactory';
import {
  FACTORY_ID,
  FACTORY_TEMPLATE_ID,
  SYSTEM_OPERATOR,
  createdEvent,
  factoryArgument,
  factoryItem,
  mockLedger,
  transaction,
} from './setupFixtures';

type Ledger = ReturnType<typeof mockLedger>;

function asClient(ledger: Ledger): LedgerJsonApiClient {
  return ledger as unknown as LedgerJsonApiClient;
}

describe('createFactory', () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = mockLedger();
  });

  it('creates an OcpFactory with its counter at 1, as system_operator, and returns its identity', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([createdEvent('factory-1', FACTORY_TEMPLATE_ID, factoryArgument())])
    );

    const result = await createFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID });

    expect(result).toEqual({
      contractId: 'factory-1',
      templateId: FACTORY_TEMPLATE_ID,
      factoryId: FACTORY_ID,
      systemOperator: SYSTEM_OPERATOR,
      updateId: 'update-1',
    });
    expect(ledger.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
    const request = ledger.submitAndWaitForTransaction.mock.calls[0]?.[0];
    expect(request?.actAs).toEqual([SYSTEM_OPERATOR]);
    expect(request?.commands).toHaveLength(1);
    const command = request?.commands[0];
    expect(command).toHaveProperty('CreateCommand.templateId', OCP_TEMPLATES.ocpFactory);
    const { createArguments } = (command as { CreateCommand: { createArguments: unknown } }).CreateCommand;
    // The arguments decode through the generated codec and say what the factory is
    expect(Fairmint.OpenCapTable.OcpFactory.OcpFactory.decoder.runWithException(createArguments)).toEqual({
      system_operator: SYSTEM_OPERATOR,
      factory_id: FACTORY_ID,
      next_cap_table_number: '1',
    });
    expect(
      Fairmint.OpenCapTable.OcpFactory.OcpFactory.encode(
        Fairmint.OpenCapTable.OcpFactory.OcpFactory.decoder.runWithException(createArguments)
      )
    ).toEqual(createArguments);
  });

  it('uses the template ID override', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([createdEvent('factory-1', FACTORY_TEMPLATE_ID, factoryArgument())])
    );

    await createFactory(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
      templateId: FACTORY_TEMPLATE_ID,
    });

    expect(ledger.submitAndWaitForTransaction.mock.calls[0]?.[0].commands[0]).toHaveProperty(
      'CreateCommand.templateId',
      FACTORY_TEMPLATE_ID
    );
  });

  it('forwards the command context and reports the choice to the observability hooks', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([createdEvent('factory-1', FACTORY_TEMPLATE_ID, factoryArgument())])
    );
    const metrics = { commandSubmitted: jest.fn(), commandSucceeded: jest.fn(), commandFailed: jest.fn() };

    await createFactory(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
      metrics,
      context: { commandId: 'create-factory-1' },
    });

    expect(ledger.submitAndWaitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'create-factory-1' })
    );
    expect(metrics.commandSubmitted).toHaveBeenCalledWith(OCP_TEMPLATES.ocpFactory, 'Create');
  });

  it.each([
    ['empty', '', OcpErrorCodes.REQUIRED_FIELD_MISSING],
    ['containing a colon', 'acme:1', OcpErrorCodes.INVALID_FORMAT],
  ])('refuses a factory ID that is %s before submitting', async (_name, factoryId, code) => {
    await expect(createFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId })).rejects.toMatchObject(
      {
        name: 'OcpValidationError',
        fieldPath: 'factoryId',
        code,
      }
    );
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('refuses an empty system operator before submitting', async () => {
    await expect(createFactory(asClient(ledger), { systemOperator: ' ', factoryId: FACTORY_ID })).rejects.toMatchObject(
      {
        name: 'OcpValidationError',
        fieldPath: 'systemOperator',
      }
    );
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('fails when the transaction creates no factory', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(transaction([]));

    await expect(
      createFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID })
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
      message: 'Expected CreatedEvent not found for OcpFactory',
    });
  });
});

describe('findFactory', () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = mockLedger();
  });

  it('queries the factory template as system_operator and returns the one live factory', async () => {
    ledger.getActiveContracts.mockResolvedValue([
      factoryItem('factory-7', factoryArgument({ next_cap_table_number: '7' })),
    ]);

    const factory = await findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID });

    expect(factory).toEqual({
      contractId: 'factory-7',
      templateId: FACTORY_TEMPLATE_ID,
      factoryId: FACTORY_ID,
      systemOperator: SYSTEM_OPERATOR,
      nextCapTableNumber: 7,
    });
    expect(ledger.getActiveContracts).toHaveBeenCalledWith({
      parties: [SYSTEM_OPERATOR],
      templateIds: [OCP_TEMPLATES.ocpFactory],
      includeCreatedEventBlob: false,
    });
  });

  it('finds none: no active factory has the identity', async () => {
    ledger.getActiveContracts.mockResolvedValue([]);

    await expect(
      findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID })
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.CONTRACT_NOT_FOUND,
      classification: 'factory_not_found',
    });
  });

  it('refuses two matches as ambiguous and names both contracts', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-a'), factoryItem('factory-b')]);

    const error: unknown = await findFactory(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      classification: 'ambiguous_factory',
      context: { contractIds: ['factory-a', 'factory-b'] },
    });
  });

  it('keeps only the factory with the identity among the active ones', async () => {
    ledger.getActiveContracts.mockResolvedValue([
      factoryItem('factory-other-id', factoryArgument({ factory_id: 'other' })),
      factoryItem('factory-other-operator', factoryArgument({ system_operator: 'other-operator::1220dddd' })),
      factoryItem('factory-mine', factoryArgument({ next_cap_table_number: '2' })),
    ]);

    const factory = await findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID });

    expect(factory.contractId).toBe('factory-mine');
    expect(factory.nextCapTableNumber).toBe(2);
  });

  it('ignores a contract of another template and an entry without a contract', async () => {
    ledger.getActiveContracts.mockResolvedValue([
      factoryItem(
        'not-a-factory',
        factoryArgument(),
        'pkg-id:Fairmint.OpenCapTable.IssuerAuthorization:IssuerAuthorization'
      ),
      { contractEntry: { JsEmpty: {} } },
      factoryItem('factory-mine'),
    ]);

    const factory = await findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID });

    expect(factory.contractId).toBe('factory-mine');
  });

  it('uses the template ID override in the query', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-1')]);

    await findFactory(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
      templateId: FACTORY_TEMPLATE_ID,
    });

    expect(ledger.getActiveContracts).toHaveBeenCalledWith(
      expect.objectContaining({ templateIds: [FACTORY_TEMPLATE_ID] })
    );
  });

  it.each([
    ['a malformed entry', [{ contractEntry: 'nope' }], 'Active contracts item has a malformed contractEntry'],
    [
      'an active contract without a created event',
      [{ contractEntry: { JsActiveContract: {} } }],
      'Active contract has no created event',
    ],
    [
      'a factory without a contract ID',
      [{ contractEntry: { JsActiveContract: { createdEvent: { templateId: FACTORY_TEMPLATE_ID } } } }],
      'Active factory has no contract ID or template ID',
    ],
  ])('rejects %s', async (_name, items, message) => {
    ledger.getActiveContracts.mockResolvedValue(items as never);

    await expect(
      findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID })
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      message: expect.stringContaining(message),
    });
  });

  it.each([['0'], ['-1'], ['1.5'], ['9223372036854775807']])(
    'rejects a counter that is not a positive safe integer (%s)',
    async (counter) => {
      ledger.getActiveContracts.mockResolvedValue([
        factoryItem('factory-1', factoryArgument({ next_cap_table_number: counter })),
      ]);

      await expect(
        findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID })
      ).rejects.toMatchObject({ name: 'OcpParseError' });
    }
  );

  it('rejects a create argument the generated codec does not accept, with the contract in the source', async () => {
    ledger.getActiveContracts.mockResolvedValue([
      factoryItem('factory-1', { system_operator: SYSTEM_OPERATOR, factory_id: FACTORY_ID }),
    ]);

    await expect(
      findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID })
    ).rejects.toMatchObject({
      name: 'OcpParseError',
      code: OcpErrorCodes.SCHEMA_MISMATCH,
      source: 'factory factory-1.createArgument',
    });
  });

  it('validates the identity before querying', async () => {
    await expect(
      findFactory(asClient(ledger), { systemOperator: SYSTEM_OPERATOR, factoryId: 'a:b' })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
    });
    await expect(findFactory(asClient(ledger), { systemOperator: '', factoryId: FACTORY_ID })).rejects.toMatchObject({
      name: 'OcpValidationError',
    });
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();
  });
});

describe('factory identity validation', () => {
  it('accepts a complete identity, with or without a template ID', () => {
    expect(() => validateFactoryIdentity({ factoryId: FACTORY_ID, systemOperator: SYSTEM_OPERATOR })).not.toThrow();
    expect(() =>
      validateFactoryIdentity({
        factoryId: FACTORY_ID,
        systemOperator: SYSTEM_OPERATOR,
        templateId: FACTORY_TEMPLATE_ID,
      })
    ).not.toThrow();
  });

  it.each([
    ['null', null, 'factory'],
    ['an array', [], 'factory'],
    ['a missing factory ID', { systemOperator: SYSTEM_OPERATOR }, 'factory.factoryId'],
    ['a factory ID with a colon', { factoryId: 'a:b', systemOperator: SYSTEM_OPERATOR }, 'factory.factoryId'],
    ['a missing system operator', { factoryId: FACTORY_ID }, 'factory.systemOperator'],
    [
      'an empty template ID',
      { factoryId: FACTORY_ID, systemOperator: SYSTEM_OPERATOR, templateId: '' },
      'factory.templateId',
    ],
    ['the v34 coordinates', { contractId: 'factory-cid', templateId: 'factory-tid' }, 'factory.factoryId'],
  ])('rejects %s', (_name, identity, fieldPath) => {
    expect(() => validateFactoryIdentity(identity)).toThrow(expect.objectContaining({ fieldPath }));
  });

  it('checks the factory ID as OcpFactory does: non-empty, no colon, anything else goes', () => {
    expect(() => validateFactoryId('acme-prod_2')).not.toThrow();
    expect(() => validateFactoryId(' ')).not.toThrow();
    expect(() => validateFactoryId(42)).toThrow(
      expect.objectContaining({ code: OcpErrorCodes.REQUIRED_FIELD_MISSING })
    );
  });
});
