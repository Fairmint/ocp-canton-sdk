import { OcpClient } from '../../../src/OcpClient';
import { createIntegrationTestSuite } from '../setup';
import { generateTestId, setupTestIssuer, setupTestStakeholder } from '../utils';

interface PartyScopedRight {
  kind: Record<string, { value?: { party?: string } }>;
}

function hasPartyRight(rights: unknown[], rightName: 'CanActAs' | 'CanReadAs', party: string): boolean {
  return rights.some((right) => {
    const kind = (right as PartyScopedRight).kind;
    return kind?.[rightName]?.value?.party === party;
  });
}

async function ensurePartyReadRights(ocp: OcpClient, party: string): Promise<void> {
  const userId = 'ledger-api-user';
  const rightsResponse = await ocp.ledger.listUserRights({ userId });
  const currentRights = rightsResponse.rights ?? [];
  const missingRights: Array<{ kind: Record<string, { value: { party: string } }> }> = [];

  if (!hasPartyRight(currentRights, 'CanActAs', party)) {
    missingRights.push({ kind: { CanActAs: { value: { party } } } });
  }
  if (!hasPartyRight(currentRights, 'CanReadAs', party)) {
    missingRights.push({ kind: { CanReadAs: { value: { party } } } });
  }

  if (missingRights.length > 0) {
    await ocp.ledger.grantUserRights({
      userId,
      rights: missingRights as never,
    });
  }
}

async function pickAlternateIssuerParty(ocp: OcpClient, authenticatedParty: string): Promise<string> {
  const partiesResponse = await ocp.ledger.listParties({});
  const alternateParty = (partiesResponse.partyDetails ?? []).map((p) => p.party).find((party) => party !== authenticatedParty);
  if (!alternateParty) {
    throw new Error('Expected LocalNet to expose at least two parties for readAs integration coverage');
  }
  return alternateParty;
}

createIntegrationTestSuite('OpenCapTable readAs multi-party regression', (getContext) => {
  test('authenticated client needs readAs to read contracts owned by a different issuer party', async () => {
    const ctx = getContext();
    const alternateIssuerParty = await pickAlternateIssuerParty(ctx.ocp, ctx.issuerParty);
    await ensurePartyReadRights(ctx.ocp, alternateIssuerParty);

    const issuerSetup = await setupTestIssuer(ctx.ocp, {
      issuerParty: alternateIssuerParty,
      systemOperatorParty: ctx.systemOperatorParty,
      ocpFactoryContractId: ctx.ocpFactoryContractId,
      issuerData: {
        id: generateTestId('issuer-readas-alt'),
        legal_name: 'ReadAs Alternate Issuer',
      },
    });

    const stakeholderSetup = await setupTestStakeholder(ctx.ocp, {
      issuerContractId: issuerSetup.issuerContractId,
      issuerParty: alternateIssuerParty,
      capTableContractDetails: issuerSetup.capTableContractDetails,
      stakeholderData: {
        id: generateTestId('stakeholder-readas-alt'),
        name: { legal_name: 'ReadAs Holder' },
        stakeholder_type: 'INDIVIDUAL',
      },
    });

    await expect(
      ctx.ocp.OpenCapTable.stakeholder.get({
        contractId: stakeholderSetup.stakeholderContractId,
      })
    ).rejects.toThrow();

    const stakeholder = await ctx.ocp.OpenCapTable.stakeholder.get({
      contractId: stakeholderSetup.stakeholderContractId,
      readAs: [alternateIssuerParty],
    });

    expect(stakeholder.data.id).toBe(stakeholderSetup.stakeholderData.id);
    expect(stakeholder.data.name.legal_name).toBe(stakeholderSetup.stakeholderData.name.legal_name);
  });
});
