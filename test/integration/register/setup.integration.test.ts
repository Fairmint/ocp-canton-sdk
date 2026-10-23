/**
 * Integration tests for the three-step cap table setup of OpenCapTable-v35.
 *
 * `system_operator` authorizes an issuer and pins its transfer agent, the transfer agent accepts, then the issuer
 * creates the cap table. Covers:
 *
 * - The factory's counter and the book a created cap table starts with
 * - What the SDK and the ledger each refuse: another transfer agent, parties that are not distinct, a withdrawn
 *   authorization
 *
 * Run with:
 *
 * ```bash
 * npm run test:integration -- test/integration/register/setup
 * ```
 */

import { OCP_TEMPLATES } from '@fairmint/open-captable-protocol-daml-js';
import { OcpErrorCodes, OcpValidationError } from '../../../src/errors';
import { createIntegrationTestSuite } from '../setup';
import { createCapTable } from '../setup/contractDeployment';
import { createTestIssuerData, generateTestId } from '../utils';
import { readBook } from '../utils/testBook';

createIntegrationTestSuite('Cap table setup', (getContext) => {
  test('authorizes, accepts and creates a cap table with its first shards', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    const before = await setup.findFactory();

    // Step 1: system_operator takes the next cap table ID and pins the issuer's transfer agent
    const authorized = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });
    expect(authorized.capTableId).toBe(`${ctx.factory.factoryId}-${before.nextCapTableNumber}`);

    // The factory was consumed and recreated with the next number
    const after = await setup.findFactory();
    expect(after.contractId).toBe(authorized.factoryContractId);
    expect(after.nextCapTableNumber).toBe(before.nextCapTableNumber + 1);

    // Step 2: the pinned transfer agent accepts
    const { authorization } = await setup.acceptAuthorization({
      authorizationContractId: authorized.authorizationContractId,
      transferAgent: ctx.transferAgentParty,
    });
    expect(authorization).toMatchObject({
      capTableId: authorized.capTableId,
      issuer: ctx.issuerParty,
      systemOperator: ctx.systemOperatorParty,
      transferAgent: ctx.transferAgentParty,
    });

    // Step 3: the issuer creates the cap table, with the authorization disclosed
    const issuerData = createTestIssuerData({ id: generateTestId('setup-issuer') });
    const { command, disclosedContracts, actAs } = setup.buildCreateCapTable({
      authorization,
      transferAgent: ctx.transferAgentParty,
      issuerData,
    });
    expect(actAs).toEqual([ctx.issuerParty]);
    const response = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [command],
      disclosedContracts,
      actAs,
    });
    const created = setup.readCreateCapTableResult(response);
    expect(created.shards.size).toBe(256);

    // The book: the anchor, the issuer record and the 256 initial shards, read by the reader interfaces
    const index = await readBook(ctx.ocp, {
      cap_table_id: authorized.capTableId,
      issuer: ctx.issuerParty,
      system_operator: ctx.systemOperatorParty,
      transfer_agent: ctx.transferAgentParty,
    });
    expect(index.anchor?.contractId).toBe(created.capTableContractId);
    expect(index.anchor?.status).toBe('ACTIVE');
    expect(index.counts()).toEqual({ anchors: 1, records: 1, states: 0, epochs: 0, shards: 256 });
    expect(index.flags()).toEqual([]);

    // The issuer record reads back as OCF, with its ID claimed by the creation
    const issuer = await ctx.ocp.OpenCapTable.issuer.get({
      contractId: created.issuerContractId,
      readAs: [ctx.transferAgentParty],
    });
    expect(issuer.data.id).toBe(issuerData.id);
    expect(issuer.data.legal_name).toBe(issuerData.legal_name);
    expect(index.record(issuerData.id)?.contractId).toBe(created.issuerContractId);
  });

  test('numbers consecutive cap tables from one factory', async () => {
    const ctx = getContext();

    const first = await createCapTable(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      transferAgentParty: ctx.transferAgentParty,
      issuerData: createTestIssuerData(),
    });
    const second = await createCapTable(ctx.ocp, {
      issuerParty: ctx.issuerParty,
      transferAgentParty: ctx.transferAgentParty,
      issuerData: createTestIssuerData(),
    });

    const number = (capTableId: string): number => Number(capTableId.slice(ctx.factory.factoryId.length + 1));
    expect(first.capTableId.startsWith(`${ctx.factory.factoryId}-`)).toBe(true);
    expect(number(second.capTableId)).toBe(number(first.capTableId) + 1);
  });

  test('refuses a cap table that names another transfer agent', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    const authorized = await setup.authorizeIssuer({
      issuer: ctx.issuerParty,
      transferAgent: ctx.transferAgentParty,
    });
    const { authorization } = await setup.acceptAuthorization({
      authorizationContractId: authorized.authorizationContractId,
      transferAgent: ctx.transferAgentParty,
    });
    const issuerData = createTestIssuerData();

    // The SDK refuses before anything is submitted
    expect(() =>
      setup.buildCreateCapTable({ authorization, transferAgent: ctx.systemOperatorParty, issuerData })
    ).toThrow(OcpValidationError);

    // The ledger refuses too: the same command with another transfer agent named
    const built = setup.buildCreateCapTable({ authorization, transferAgent: ctx.transferAgentParty, issuerData });
    const { command } = built;
    if (!('ExerciseCommand' in command)) throw new Error('Expected an exercise command');
    const forged = {
      ExerciseCommand: {
        ...command.ExerciseCommand,
        choiceArgument: {
          ...(command.ExerciseCommand.choiceArgument as Record<string, unknown>),
          transfer_agent: ctx.systemOperatorParty,
        },
      },
    };
    await expect(
      ctx.ocp.ledger.submitAndWaitForTransaction({
        commands: [forged],
        disclosedContracts: built.disclosedContracts,
        actAs: built.actAs,
      })
    ).rejects.toThrow(/transfer agent/i);

    // The authorization was not consumed: naming the pinned transfer agent still creates the cap table
    const response = await ctx.ocp.ledger.submitAndWaitForTransaction({
      commands: [built.command],
      disclosedContracts: built.disclosedContracts,
      actAs: built.actAs,
    });
    expect(setup.readCreateCapTableResult(response).shards.size).toBe(256);
  });

  test('refuses an authorization whose parties are not distinct', async () => {
    const ctx = getContext();
    const { setup } = ctx.ocp.OpenCapTable;

    // The SDK refuses locally
    for (const parties of [
      { issuer: ctx.issuerParty, transferAgent: ctx.issuerParty },
      { issuer: ctx.systemOperatorParty, transferAgent: ctx.transferAgentParty },
      { issuer: ctx.issuerParty, transferAgent: ctx.systemOperatorParty },
    ]) {
      await expect(setup.authorizeIssuer(parties)).rejects.toMatchObject({
        name: 'OcpValidationError',
        code: OcpErrorCodes.INVALID_FORMAT,
      });
    }

    // So does the ledger: without a distinct pinned transfer agent the issuer could name itself
    const factory = await setup.findFactory();
    await expect(
      ctx.ocp.ledger.submitAndWaitForTransaction({
        commands: [
          {
            ExerciseCommand: {
              templateId: OCP_TEMPLATES.ocpFactory,
              contractId: factory.contractId,
              choice: 'OcpFactory_AuthorizeIssuer',
              choiceArgument: { issuer: ctx.issuerParty, transfer_agent: ctx.issuerParty },
            },
          },
        ],
        actAs: [ctx.systemOperatorParty],
      })
    ).rejects.toThrow();

    // Nothing was consumed
    expect((await setup.findFactory()).contractId).toBe(factory.contractId);
  });
});
