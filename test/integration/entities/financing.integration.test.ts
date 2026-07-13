import type { OcfFinancing } from '../../../src';
import { createIntegrationTestSuite } from '../setup';
import { generateDateString, generateTestId, getCapTableDetails, setupStockSecurity, setupTestIssuer } from '../utils';

function requireTaggedContractId(values: readonly unknown[], expectedTag: string): string {
  for (const value of values) {
    if (value && typeof value === 'object' && 'tag' in value && 'value' in value) {
      const tagged = value as { tag?: unknown; value?: unknown };
      if (tagged.tag === expectedTag && typeof tagged.value === 'string') return tagged.value;
    }
  }
  throw new Error(`Missing ${expectedTag} contract ID`);
}

createIntegrationTestSuite('Financing operations', (getContext) => {
  test('creates, reads, edits, and deletes a Financing that references an issuance', async () => {
    const ctx = getContext();
    const issuer = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });
    const stock = await setupStockSecurity(ctx.ocp, {
      issuerContractId: issuer.issuerContractId,
      issuerParty: ctx.issuerParty,
      capTableContractDetails: issuer.capTableContractDetails,
    });
    const { data: issuance } = await ctx.ocp.OpenCapTable.stockIssuance.get({
      contractId: stock.stockIssuanceContractId,
    });
    const { synchronizerId } = issuer.capTableContractDetails;
    const stockCapTableDetails = await getCapTableDetails(ctx.ocp, stock.capTableContractId, synchronizerId);
    const financing: OcfFinancing = {
      object_type: 'FINANCING',
      id: generateTestId('financing'),
      name: 'Series A',
      issuance_ids: [issuance.id],
      date: generateDateString(),
    };

    const created = await ctx.ocp.OpenCapTable.capTable
      .update({
        capTableContractId: stock.capTableContractId,
        capTableContractDetails: stockCapTableDetails,
        actAs: [ctx.issuerParty],
      })
      .create('financing', financing)
      .execute();
    const financingContractId = requireTaggedContractId(created.createdCids, 'CidFinancing');

    await expect(ctx.ocp.OpenCapTable.financing.get({ contractId: financingContractId })).resolves.toMatchObject({
      data: financing,
      contractId: financingContractId,
    });

    const createdCapTableDetails = await getCapTableDetails(ctx.ocp, created.updatedCapTableCid, synchronizerId);
    const editedData = { ...financing, name: 'Series A Final Close' };
    const edited = await ctx.ocp.OpenCapTable.capTable
      .update({
        capTableContractId: created.updatedCapTableCid,
        capTableContractDetails: createdCapTableDetails,
        actAs: [ctx.issuerParty],
      })
      .edit('financing', editedData)
      .execute();
    const editedContractId = requireTaggedContractId(edited.editedCids, 'CidFinancing');

    await expect(ctx.ocp.OpenCapTable.financing.get({ contractId: editedContractId })).resolves.toMatchObject({
      data: editedData,
      contractId: editedContractId,
    });

    const editedCapTableDetails = await getCapTableDetails(ctx.ocp, edited.updatedCapTableCid, synchronizerId);
    await expect(
      ctx.ocp.OpenCapTable.capTable
        .update({
          capTableContractId: edited.updatedCapTableCid,
          capTableContractDetails: editedCapTableDetails,
          actAs: [ctx.issuerParty],
        })
        .delete('financing', financing.id)
        .execute()
    ).resolves.toMatchObject({ updatedCapTableCid: expect.any(String) });
  });

  test('leaves missing issuance reference rejection to DAML', async () => {
    const ctx = getContext();
    const issuer = await setupTestIssuer(ctx.ocp, {
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerParty: ctx.issuerParty,
    });
    const financingId = generateTestId('invalid-financing');
    const missingIssuanceId = generateTestId('missing-issuance');
    const batch = ctx.ocp.OpenCapTable.capTable
      .update({
        capTableContractId: issuer.issuerContractId,
        capTableContractDetails: issuer.capTableContractDetails,
        actAs: [ctx.issuerParty],
      })
      .create('financing', {
        object_type: 'FINANCING',
        id: financingId,
        name: 'Invalid round',
        issuance_ids: [missingIssuanceId],
        date: generateDateString(),
      });

    expect(() => batch.build()).not.toThrow();
    let rejection: unknown;
    try {
      await batch.execute();
    } catch (error: unknown) {
      rejection = error;
    }

    if (!(rejection instanceof Error)) {
      throw new Error('Expected DAML to reject the missing Financing issuance reference');
    }
    expect(rejection.message).toContain(
      `Financing ${financingId} issuance reference must match exactly one issuance object: ${missingIssuanceId} (matches 0)`
    );
  });
});
