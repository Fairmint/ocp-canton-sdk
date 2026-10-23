import { OcpValidationError, type OcfFinancing } from '../../../src';
import { resolveInputs } from '../../../src/register/inputs';
import { createIntegrationTestSuite } from '../setup';
import {
  applyOperations,
  generateDateString,
  generateTestId,
  readTestBook,
  recordContractId,
  restateOperations,
  setupStockSecurity,
  setupTestBook,
} from '../utils';

createIntegrationTestSuite('Financing operations', (getContext) => {
  test('creates, reads, edits, and deletes a Financing that references an issuance', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stock = await setupStockSecurity(book);
    const { data: issuance } = await ctx.ocp.OpenCapTable.stockIssuance.get({
      contractId: stock.stockIssuanceContractId,
      readAs: [ctx.transferAgentParty],
    });
    const financing: OcfFinancing = {
      object_type: 'FINANCING',
      id: generateTestId('financing'),
      name: 'Series A',
      issuance_ids: [issuance.id],
      date: generateDateString(),
    };

    const created = await applyOperations(book, [{ kind: 'record', type: 'financing', data: financing }]);
    const financingContractId = created.get(financing.id)?.contractId ?? '';

    await expect(
      ctx.ocp.OpenCapTable.financing.get({ contractId: financingContractId, readAs: [ctx.transferAgentParty] })
    ).resolves.toMatchObject({ data: financing, contractId: financingContractId });

    // An edit recreates the record under the same ID
    const editedData = { ...financing, name: 'Series A Final Close' };
    const edited = await restateOperations(book, [{ kind: 'edit', type: 'financing', data: editedData }]);
    const editedContractId = edited.get(financing.id)?.contractId ?? '';
    expect(editedContractId).not.toBe(financingContractId);

    await expect(
      ctx.ocp.OpenCapTable.financing.get({ contractId: editedContractId, readAs: [ctx.transferAgentParty] })
    ).resolves.toMatchObject({ data: editedData, contractId: editedContractId });

    // The financing references the issuance, never the other way round: deleting it leaves the issuance
    await restateOperations(book, [{ kind: 'delete', objectId: financing.id }]);
    const index = await readTestBook(book);
    expect(index.record(financing.id)).toBeNull();
    expect(index.record(issuance.id)?.contractId).toBe(recordContractId(book, issuance.id));
  });

  test('leaves missing issuance reference rejection to the ledger', async () => {
    const ctx = getContext();
    const book = await setupTestBook(ctx);
    const stock = await setupStockSecurity(book);

    const financing: OcfFinancing = {
      object_type: 'FINANCING',
      id: generateTestId('invalid-financing'),
      name: 'Invalid round',
      issuance_ids: [generateTestId('missing-issuance')],
      date: generateDateString(),
    };

    // The SDK refuses the write before it is submitted, with the ledger's message
    await expect(applyOperations(book, [{ kind: 'record', type: 'financing', data: financing }])).rejects.toThrow(
      OcpValidationError
    );

    // Bypassing the preflight (inputs taken from a valid financing of the same ID) reaches the ledger, which refuses it
    const valid = { ...financing, issuance_ids: [stock.stockIssuanceId] };
    const { inputs } = resolveInputs(book.writer.index, {
      kind: 'apply',
      operations: [{ kind: 'record', type: 'financing', data: valid }],
    });
    const batch = ctx.ocp.OpenCapTable.capTable
      .apply({ ...book.writer.capTableAnchor(), transferAgent: ctx.transferAgentParty, inputs })
      .create('financing', financing);
    expect(() => batch.build()).not.toThrow();

    let rejection: unknown;
    try {
      await batch.execute();
    } catch (error: unknown) {
      rejection = error;
    }
    expect(rejection).toMatchObject({ code: 'CHOICE_FAILED', choice: 'CapTable_Apply' });
    expect((rejection as Error).message).toContain(`Financing issuance not found: ${financing.issuance_ids[0]}`);
  });
});
