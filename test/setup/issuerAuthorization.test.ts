import type { LedgerJsonApiClient } from '@fairmint/canton-node-sdk';
import { Fairmint, OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes } from '../../src/errors';
import { acceptIssuerAuthorization } from '../../src/functions/OpenCapTable/issuerAuthorization/acceptIssuerAuthorization';
import { authorizeIssuer } from '../../src/functions/OpenCapTable/issuerAuthorization/authorizeIssuer';
import {
  buildCreateCapTableCommand,
  readCreateCapTableResult,
} from '../../src/functions/OpenCapTable/issuerAuthorization/createCapTable';
import { withdrawAuthorization } from '../../src/functions/OpenCapTable/issuerAuthorization/withdrawAuthorization';
import { INITIAL_SHARD_PREFIXES } from '../../src/register/ids';
import {
  AUTHORIZATION_TEMPLATE_ID,
  CAP_TABLE_ID,
  FACTORY_ID,
  FACTORY_TEMPLATE_ID,
  ISSUER,
  ISSUER_DATA,
  SYSTEM_OPERATOR,
  TRANSFER_AGENT,
  authorizationEvents,
  authorizationRef,
  context,
  createdEvent,
  exercisedEvent,
  factoryArgument,
  factoryItem,
  initialShardEntries,
  mockLedger,
  transaction,
} from './setupFixtures';

type Ledger = ReturnType<typeof mockLedger>;

function asClient(ledger: Ledger): LedgerJsonApiClient {
  return ledger as unknown as LedgerJsonApiClient;
}

function submittedRequest(ledger: Ledger) {
  expect(ledger.submitAndWaitForTransaction).toHaveBeenCalledTimes(1);
  const request = ledger.submitAndWaitForTransaction.mock.calls[0]?.[0];
  if (request === undefined) throw new Error('nothing submitted');
  return request;
}

function exercise(ledger: Ledger): { templateId: string; contractId: string; choice: string; choiceArgument: unknown } {
  const [command] = submittedRequest(ledger).commands;
  if (command === undefined || !('ExerciseCommand' in command)) throw new Error('expected an ExerciseCommand');
  return command.ExerciseCommand;
}

const AUTHORIZE = 'OcpFactory_AuthorizeIssuer';
const ACCEPT = 'IssuerAuthorization_TaAccept';
const CREATE_CAP_TABLE = 'IssuerAuthorization_CreateCapTable';

function authorizeTransaction(factoryContractId = 'factory-live') {
  return transaction([
    exercisedEvent(factoryContractId, FACTORY_TEMPLATE_ID, AUTHORIZE, {
      factory: 'factory-2',
      authorization: 'authorization-1',
      cap_table_id: CAP_TABLE_ID,
    }),
    createdEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, { context: context(), ta_accepted: false }),
    createdEvent('factory-2', FACTORY_TEMPLATE_ID, factoryArgument({ next_cap_table_number: '2' })),
  ]);
}

describe('authorizeIssuer', () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = mockLedger();
  });

  it('exercises OcpFactory_AuthorizeIssuer as system_operator on the factory the caller holds', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(authorizeTransaction());

    const result = await authorizeIssuer(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
      issuer: ISSUER,
      transferAgent: TRANSFER_AGENT,
      factoryContractId: 'factory-live',
    });

    const request = submittedRequest(ledger);
    expect(request.actAs).toEqual([SYSTEM_OPERATOR]);
    expect(request.commands).toHaveLength(1);
    const command = exercise(ledger);
    expect(command).toMatchObject({
      templateId: OCP_TEMPLATES.ocpFactory,
      contractId: 'factory-live',
      choice: AUTHORIZE,
    });
    // The argument decodes through the generated choice codec
    expect(
      Fairmint.OpenCapTable.OcpFactory.OcpFactory_AuthorizeIssuer.decoder.runWithException(command.choiceArgument)
    ).toEqual({
      issuer: ISSUER,
      transfer_agent: TRANSFER_AGENT,
    });
    expect(command.choiceArgument).toEqual({ issuer: ISSUER, transfer_agent: TRANSFER_AGENT });
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      updateId: 'update-1',
      factoryContractId: 'factory-2',
      authorizationContractId: 'authorization-1',
      authorizationTemplateId: AUTHORIZATION_TEMPLATE_ID,
      capTableId: CAP_TABLE_ID,
    });
  });

  it('finds the live factory when the caller holds none and exercises it under the ledger template ID', async () => {
    ledger.getActiveContracts.mockResolvedValue([factoryItem('factory-found')]);
    ledger.submitAndWaitForTransaction.mockResolvedValue(authorizeTransaction('factory-found'));

    await authorizeIssuer(asClient(ledger), {
      systemOperator: SYSTEM_OPERATOR,
      factoryId: FACTORY_ID,
      issuer: ISSUER,
      transferAgent: TRANSFER_AGENT,
    });

    expect(ledger.getActiveContracts).toHaveBeenCalledWith(
      expect.objectContaining({ parties: [SYSTEM_OPERATOR], templateIds: [OCP_TEMPLATES.ocpFactory] })
    );
    expect(exercise(ledger)).toMatchObject({ templateId: FACTORY_TEMPLATE_ID, contractId: 'factory-found' });
  });

  it('does not submit when no factory is found', async () => {
    ledger.getActiveContracts.mockResolvedValue([]);

    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        issuer: ISSUER,
        transferAgent: TRANSFER_AGENT,
      })
    ).rejects.toMatchObject({ name: 'OcpContractError', code: OcpErrorCodes.CONTRACT_NOT_FOUND });
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['the issuer is the system operator', { issuer: SYSTEM_OPERATOR, transferAgent: TRANSFER_AGENT }],
    ['the issuer is its own transfer agent', { issuer: ISSUER, transferAgent: ISSUER }],
    ['the transfer agent is the system operator', { issuer: ISSUER, transferAgent: SYSTEM_OPERATOR }],
    ['all three are one party', { issuer: SYSTEM_OPERATOR, transferAgent: SYSTEM_OPERATOR }],
  ])('refuses locally, before any ledger call, when %s', async (_name, parties) => {
    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        factoryContractId: 'factory-live',
        ...parties,
      })
    ).rejects.toMatchObject({
      name: 'OcpValidationError',
      code: OcpErrorCodes.INVALID_FORMAT,
      message: expect.stringContaining('three distinct parties'),
    });
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
    expect(ledger.getActiveContracts).not.toHaveBeenCalled();
  });

  it.each([
    ['issuer', { issuer: '', transferAgent: TRANSFER_AGENT }],
    ['transferAgent', { issuer: ISSUER, transferAgent: '' }],
  ])('requires the %s party', async (fieldPath, parties) => {
    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        factoryContractId: 'factory-live',
        ...parties,
      })
    ).rejects.toMatchObject({ name: 'OcpValidationError', fieldPath });
  });

  it('refuses an empty factory contract ID and an invalid factory ID', async () => {
    const params = { systemOperator: SYSTEM_OPERATOR, issuer: ISSUER, transferAgent: TRANSFER_AGENT };

    await expect(
      authorizeIssuer(asClient(ledger), { ...params, factoryId: FACTORY_ID, factoryContractId: '' })
    ).rejects.toMatchObject({ name: 'OcpValidationError', fieldPath: 'factoryContractId' });
    await expect(authorizeIssuer(asClient(ledger), { ...params, factoryId: 'a:b' })).rejects.toMatchObject({
      name: 'OcpValidationError',
      fieldPath: 'factoryId',
    });
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  it('fails when the transaction carries no exercise result', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([
        createdEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, { context: context(), ta_accepted: false }),
      ])
    );

    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        issuer: ISSUER,
        transferAgent: TRANSFER_AGENT,
        factoryContractId: 'factory-live',
      })
    ).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
      choice: AUTHORIZE,
    });
  });

  it('rejects a result that is not an OcpFactory_AuthorizeIssuerResult', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      transaction([exercisedEvent('factory-live', FACTORY_TEMPLATE_ID, AUTHORIZE, { factory: 'factory-2' })])
    );

    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        issuer: ISSUER,
        transferAgent: TRANSFER_AGENT,
        factoryContractId: 'factory-live',
      })
    ).rejects.toMatchObject({ name: 'OcpParseError', source: `${AUTHORIZE}.exerciseResult` });
  });

  it('refuses a result from an exercise of another contract', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(authorizeTransaction('some-other-factory'));

    await expect(
      authorizeIssuer(asClient(ledger), {
        systemOperator: SYSTEM_OPERATOR,
        factoryId: FACTORY_ID,
        issuer: ISSUER,
        transferAgent: TRANSFER_AGENT,
        factoryContractId: 'factory-live',
      })
    ).rejects.toMatchObject({ code: OcpErrorCodes.RESULT_NOT_FOUND });
  });
});

describe('acceptIssuerAuthorization', () => {
  let ledger: Ledger;
  const expected = { issuer: ISSUER, systemOperator: SYSTEM_OPERATOR, factoryId: FACTORY_ID };
  const params = { authorizationContractId: 'authorization-1', transferAgent: TRANSFER_AGENT, expected };

  function acceptTransaction(
    createdExtra: object = { createdEventBlob: 'blob-accepted' },
    accepted = true,
    context_ = context()
  ) {
    return transaction([
      exercisedEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, ACCEPT, 'authorization-accepted'),
      createdEvent(
        'authorization-accepted',
        AUTHORIZATION_TEMPLATE_ID,
        { context: context_, ta_accepted: accepted },
        createdExtra
      ),
    ]);
  }

  beforeEach(() => {
    ledger = mockLedger();
    ledger.getEventsByContractId.mockResolvedValueOnce(authorizationEvents() as never);
  });

  it('exercises IssuerAuthorization_TaAccept as the transfer agent and returns the recreated authorization', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(acceptTransaction());

    const result = await acceptIssuerAuthorization(asClient(ledger), {
      ...params,
      expected: { ...expected, capTableId: CAP_TABLE_ID },
    });

    // The transfer agent read the authorization before it signed anything
    expect(ledger.getEventsByContractId).toHaveBeenCalledTimes(1);
    expect(ledger.getEventsByContractId).toHaveBeenCalledWith({
      contractId: 'authorization-1',
      readAs: [TRANSFER_AGENT],
    });
    expect(ledger.getEventsByContractId.mock.invocationCallOrder[0]).toBeLessThan(
      ledger.submitAndWaitForTransaction.mock.invocationCallOrder[0] ?? 0
    );
    expect(submittedRequest(ledger).actAs).toEqual([TRANSFER_AGENT]);
    const command = exercise(ledger);
    expect(command).toMatchObject({
      templateId: OCP_TEMPLATES.issuerAuthorization,
      contractId: 'authorization-1',
      choice: ACCEPT,
    });
    expect(
      Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_TaAccept.decoder.runWithException(
        command.choiceArgument
      )
    ).toEqual({});
    expect(result.updateId).toBe('update-1');
    expect(result.authorization).toEqual({
      contractId: 'authorization-accepted',
      templateId: AUTHORIZATION_TEMPLATE_ID,
      createdEventBlob: 'blob-accepted',
      synchronizerId: 'synchronizer-1',
      capTableId: CAP_TABLE_ID,
      issuer: ISSUER,
      systemOperator: SYSTEM_OPERATOR,
      transferAgent: TRANSFER_AGENT,
    });
  });

  it('reads the created-event blob from the contract events when the transaction carries none', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(acceptTransaction({}));
    ledger.getEventsByContractId.mockResolvedValueOnce({
      created: { createdEvent: { createdEventBlob: 'blob-from-events' } },
    } as never);

    const result = await acceptIssuerAuthorization(asClient(ledger), params);

    expect(ledger.getEventsByContractId).toHaveBeenNthCalledWith(2, {
      contractId: 'authorization-accepted',
      readAs: [TRANSFER_AGENT],
    });
    expect(result.authorization.createdEventBlob).toBe('blob-from-events');
  });

  it('fails when the recreated authorization cannot be disclosed', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(acceptTransaction({}));
    ledger.getEventsByContractId.mockResolvedValueOnce({ created: null } as never);

    await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  });

  it('fails when the transaction has no synchronizer', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue({
      transaction: { ...acceptTransaction().transaction, synchronizerId: '' },
    });

    await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({
      name: 'OcpContractError',
      code: OcpErrorCodes.RESULT_NOT_FOUND,
    });
  });

  it('rejects a recreated authorization the transfer agent has not accepted', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(acceptTransaction({ createdEventBlob: 'b' }, false));

    await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({
      name: 'OcpParseError',
      message: expect.stringContaining('not accepted'),
    });
  });

  it('rejects an authorization that pins another transfer agent', async () => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(
      acceptTransaction({ createdEventBlob: 'b' }, true, context({ transfer_agent: 'other-agent::1220eeee' }))
    );

    await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({
      name: 'OcpParseError',
      message: expect.stringContaining('another transfer agent'),
    });
  });

  it.each([
    [
      'no created event for the result',
      transaction([exercisedEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, ACCEPT, 'authorization-accepted')]),
      'OcpContractError',
    ],
    [
      'a result that is not a contract ID',
      transaction([exercisedEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, ACCEPT, { not: 'a contract id' })]),
      'OcpParseError',
    ],
    [
      'a recreated contract of another template',
      transaction([
        exercisedEvent('authorization-1', AUTHORIZATION_TEMPLATE_ID, ACCEPT, 'authorization-accepted'),
        createdEvent('authorization-accepted', FACTORY_TEMPLATE_ID, factoryArgument()),
      ]),
      'OcpParseError',
    ],
  ])('rejects %s', async (_name, response, errorName) => {
    ledger.submitAndWaitForTransaction.mockResolvedValue(response);

    await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({ name: errorName });
  });

  it('validates its parameters before reading or submitting', async () => {
    await expect(
      acceptIssuerAuthorization(asClient(ledger), { ...params, authorizationContractId: '' })
    ).rejects.toMatchObject({ fieldPath: 'authorizationContractId' });
    await expect(acceptIssuerAuthorization(asClient(ledger), { ...params, transferAgent: '' })).rejects.toMatchObject({
      fieldPath: 'transferAgent',
    });
    await expect(
      acceptIssuerAuthorization(asClient(ledger), { ...params, expected: undefined } as never)
    ).rejects.toMatchObject({ fieldPath: 'expected' });
    await expect(
      acceptIssuerAuthorization(asClient(ledger), { ...params, expected: { ...expected, issuer: '' } })
    ).rejects.toMatchObject({ fieldPath: 'expected.issuer' });
    await expect(
      acceptIssuerAuthorization(asClient(ledger), { ...params, expected: { ...expected, factoryId: 'a:b' } })
    ).rejects.toMatchObject({ fieldPath: 'expected.factoryId' });
    expect(ledger.getEventsByContractId).not.toHaveBeenCalled();
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });

  describe('refuses before the transfer agent signs anything', () => {
    beforeEach(() => {
      ledger.getEventsByContractId.mockReset();
    });

    it.each([
      [
        'an authorization of another system_operator',
        authorizationEvents({
          context: context({ system_operator: 'rogue-operator::1220dddd' }),
          signatories: ['rogue-operator::1220dddd'],
        }),
        'signatories',
      ],
      [
        'an authorization whose context names another system_operator than its signatory',
        authorizationEvents({ context: context({ system_operator: 'rogue-operator::1220dddd' }) }),
        'system_operator',
      ],
      [
        'an authorization for another issuer',
        authorizationEvents({ context: context({ issuer: 'other-issuer::1220eeee' }) }),
        'issuer',
      ],
      [
        'an authorization that pins another transfer agent',
        authorizationEvents({ context: context({ transfer_agent: 'other-agent::1220eeee' }) }),
        'transfer_agent',
      ],
      [
        'a cap table ID outside the factory',
        authorizationEvents({ context: context({ cap_table_id: 'other-factory-1' }) }),
        'factory acme',
      ],
      [
        'a cap table ID the factory counter never issues',
        authorizationEvents({ context: context({ cap_table_id: `${FACTORY_ID}-01` }) }),
        'factory acme',
      ],
      [
        'an authorization the transfer agent has accepted already',
        authorizationEvents({ taAccepted: true }),
        'accepted',
      ],
      ['an archived authorization', authorizationEvents({ archived: true }), 'no longer active'],
      ['a contract of another package', authorizationEvents({ packageName: 'OpenCapTable-v34' }), 'OpenCapTable-v34'],
      ['a contract of another template', authorizationEvents({ templateId: FACTORY_TEMPLATE_ID }), 'template'],
      ['a contract with no created event', { created: null }, 'cannot be read'],
    ])('%s', async (_name, events, reason) => {
      ledger.getEventsByContractId.mockResolvedValueOnce(events as never);

      await expect(acceptIssuerAuthorization(asClient(ledger), params)).rejects.toMatchObject({
        name: 'OcpContractError',
        code: OcpErrorCodes.AUTHORIZATION_FAILED,
        classification: 'unexpected_issuer_authorization',
        message: expect.stringContaining(reason),
      });
      expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
    });

    it('an authorization for another cap table than the one expected', async () => {
      ledger.getEventsByContractId.mockResolvedValueOnce(
        authorizationEvents({ context: context({ cap_table_id: `${FACTORY_ID}-2` }) }) as never
      );

      await expect(
        acceptIssuerAuthorization(asClient(ledger), { ...params, expected: { ...expected, capTableId: CAP_TABLE_ID } })
      ).rejects.toMatchObject({
        code: OcpErrorCodes.AUTHORIZATION_FAILED,
        message: expect.stringContaining(`cap_table_id is ${FACTORY_ID}-2, not ${CAP_TABLE_ID}`),
      });
      expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
    });
  });
});

describe('buildCreateCapTableCommand', () => {
  it('exercises IssuerAuthorization_CreateCapTable as the issuer with the authorization disclosed', () => {
    const built = buildCreateCapTableCommand({
      authorization: authorizationRef(),
      transferAgent: TRANSFER_AGENT,
      issuerData: ISSUER_DATA,
    });

    expect(built.actAs).toEqual([ISSUER]);
    expect(built.disclosedContracts).toEqual([
      {
        templateId: AUTHORIZATION_TEMPLATE_ID,
        contractId: 'authorization-accepted',
        createdEventBlob: 'blob-accepted',
        synchronizerId: 'synchronizer-1',
      },
    ]);
    expect(built.command).toMatchObject({
      ExerciseCommand: {
        templateId: AUTHORIZATION_TEMPLATE_ID,
        contractId: 'authorization-accepted',
        choice: CREATE_CAP_TABLE,
      },
    });
    const { choiceArgument } = (built.command as { ExerciseCommand: { choiceArgument: unknown } }).ExerciseCommand;
    const decoded =
      Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_CreateCapTable.decoder.runWithException(
        choiceArgument
      );
    expect(decoded.transfer_agent).toBe(TRANSFER_AGENT);
    expect(decoded.issuer_data).toMatchObject({
      id: 'issuer-001',
      legal_name: 'Acme Inc.',
      formation_date: '2024-01-15',
      country_of_formation: 'US',
    });
    expect(Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_CreateCapTable.encode(decoded)).toEqual(
      choiceArgument
    );
  });

  it('refuses an issuer ID in the cap table derived form, which no claim accepts', () => {
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef(),
        transferAgent: TRANSFER_AGENT,
        issuerData: { ...ISSUER_DATA, id: `${CAP_TABLE_ID}:abc123` },
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'issuerData.id',
        code: OcpErrorCodes.INVALID_FORMAT,
        message: expect.stringContaining('derived form'),
      })
    );
  });

  it('accepts an issuer ID that only resembles another cap table derived form', () => {
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef(),
        transferAgent: TRANSFER_AGENT,
        issuerData: { ...ISSUER_DATA, id: 'other-cap-table-9:abc123' },
      })
    ).not.toThrow();
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef(),
        transferAgent: TRANSFER_AGENT,
        issuerData: { ...ISSUER_DATA, id: `${CAP_TABLE_ID}-2` },
      })
    ).not.toThrow();
  });

  it('refuses a transfer agent other than the one the authorization pins', () => {
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef(),
        transferAgent: 'other-agent::1220eeee',
        issuerData: ISSUER_DATA,
      })
    ).toThrow(
      expect.objectContaining({
        name: 'OcpValidationError',
        fieldPath: 'transferAgent',
        message: expect.stringContaining('pins'),
      })
    );
  });

  it.each([
    'contractId',
    'templateId',
    'createdEventBlob',
    'synchronizerId',
    'capTableId',
    'issuer',
    'systemOperator',
    'transferAgent',
  ] as const)('requires authorization.%s', (field) => {
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef({ [field]: '' }),
        transferAgent: TRANSFER_AGENT,
        issuerData: ISSUER_DATA,
      })
    ).toThrow(expect.objectContaining({ name: 'OcpValidationError', fieldPath: `authorization.${field}` }));
  });

  it('validates the issuer data against the OCF schema', () => {
    expect(() =>
      buildCreateCapTableCommand({
        authorization: authorizationRef(),
        transferAgent: TRANSFER_AGENT,
        issuerData: { ...ISSUER_DATA, formation_date: 'not-a-date' },
      })
    ).toThrow(expect.objectContaining({ name: 'OcpValidationError' }));
  });
});

describe('readCreateCapTableResult', () => {
  function createResult(shards: Array<[string, string]> = initialShardEntries()) {
    return { cap_table: 'cap-table-1', issuer: 'issuer-record-1', shards };
  }

  it('decodes the cap table, the issuer record and the 256 initial shards', () => {
    const result = readCreateCapTableResult(
      transaction([
        exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, CREATE_CAP_TABLE, createResult()),
      ])
    );

    expect(result.capTableContractId).toBe('cap-table-1');
    expect(result.issuerContractId).toBe('issuer-record-1');
    // In prefix order, not the order an object would keep for numeric-looking keys
    expect([...result.shards.keys()]).toEqual([...INITIAL_SHARD_PREFIXES]);
    expect(result.shards.get('00000000')).toBe('shard-00000000');
    expect(result.shards.get('11111111')).toBe('shard-11111111');
  });

  it('refuses a result without the 256 initial prefixes', () => {
    const short = initialShardEntries().slice(1);
    expect(() =>
      readCreateCapTableResult(
        transaction([
          exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, CREATE_CAP_TABLE, createResult(short)),
        ])
      )
    ).toThrow(expect.objectContaining({ name: 'OcpParseError', classification: 'initial_shards_mismatch' }));

    const wrong = initialShardEntries().map(([prefix, cid], i): [string, string] => [
      i === 0 ? '0000000' : prefix,
      cid,
    ]);
    expect(() =>
      readCreateCapTableResult(
        transaction([
          exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, CREATE_CAP_TABLE, createResult(wrong)),
        ])
      )
    ).toThrow(expect.objectContaining({ classification: 'initial_shards_mismatch' }));
  });

  it('fails when the transaction was read without exercised events', () => {
    expect(() =>
      readCreateCapTableResult(
        transaction([createdEvent('cap-table-1', 'pkg:Fairmint.OpenCapTable.CapTable:CapTable', {})])
      )
    ).toThrow(expect.objectContaining({ name: 'OcpContractError', code: OcpErrorCodes.RESULT_NOT_FOUND }));
  });

  it('rejects a result that does not decode', () => {
    expect(() =>
      readCreateCapTableResult(
        transaction([
          exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, CREATE_CAP_TABLE, {
            cap_table: 'c',
            issuer: 'i',
          }),
        ])
      )
    ).toThrow(expect.objectContaining({ name: 'OcpParseError' }));
  });

  it('refuses a transaction that exercises the choice twice', () => {
    const event = exercisedEvent('authorization-accepted', AUTHORIZATION_TEMPLATE_ID, CREATE_CAP_TABLE, createResult());
    expect(() => readCreateCapTableResult(transaction([event, event]))).toThrow(
      expect.objectContaining({ classification: 'ambiguous_exercise_result' })
    );
  });
});

describe('withdrawAuthorization', () => {
  it('exercises IssuerAuthorization_Withdraw as system_operator', async () => {
    const ledger = mockLedger();
    ledger.submitAndWaitForTransaction.mockResolvedValue(transaction([]));

    const result = await withdrawAuthorization(asClient(ledger), {
      authorizationContractId: 'authorization-1',
      systemOperator: SYSTEM_OPERATOR,
    });

    expect(result.updateId).toBe('update-1');
    expect(submittedRequest(ledger).actAs).toEqual([SYSTEM_OPERATOR]);
    const command = exercise(ledger);
    expect(command).toMatchObject({
      templateId: OCP_TEMPLATES.issuerAuthorization,
      contractId: 'authorization-1',
      choice: 'IssuerAuthorization_Withdraw',
    });
    expect(
      Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization_Withdraw.decoder.runWithException(
        command.choiceArgument
      )
    ).toEqual({});
  });

  it('validates its parameters before submitting', async () => {
    const ledger = mockLedger();

    await expect(
      withdrawAuthorization(asClient(ledger), { authorizationContractId: '', systemOperator: SYSTEM_OPERATOR })
    ).rejects.toMatchObject({ fieldPath: 'authorizationContractId' });
    await expect(
      withdrawAuthorization(asClient(ledger), { authorizationContractId: 'authorization-1', systemOperator: '' })
    ).rejects.toMatchObject({ fieldPath: 'systemOperator' });
    expect(ledger.submitAndWaitForTransaction).not.toHaveBeenCalled();
  });
});
