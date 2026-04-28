import { buildReferenceManifest } from '../scripts/export-reference-manifest';

describe('reference manifest export', () => {
  it('builds JSON with package metadata and OcpClient namespaces', () => {
    const m = buildReferenceManifest();

    expect(m.schemaVersion).toBe(1);
    expect(m.package.name).toBe('@open-captable-protocol/canton');
    expect(m.package.version).toMatch(/^\d+\.\d+\.\d+/);

    expect(m.dependencyMatrix.peerDependencies['@fairmint/canton-node-sdk']).toBeDefined();
    expect(m.dependencyMatrix.peerDependencies['@fairmint/open-captable-protocol-daml-js']).toBeDefined();
    expect(m.dependencyMatrix.ocpClientConstructor.ledger.required).toBe(true);
    expect(m.dependencyMatrix.ocpClientConstructor.validator.required).toBe(false);

    const oct = m.ocpClient.namespaces.OpenCapTable.members;
    expect(oct.issuer).toBeDefined();
    expect(oct.stakeholder).toBeDefined();
    expect(oct.capTable).toBeDefined();
    expect(oct.issuerAuthorization).toBeDefined();

    const cap = oct.capTable;
    expect(cap.kind).toBe('nested');
    if (cap.kind !== 'nested') {
      throw new Error('expected capTable nested shape');
    }
    expect(cap.members.classify).toBeDefined();
    expect(cap.members.getState).toBeDefined();
    expect(cap.members.update).toBeDefined();
    expect(cap.members.archive).toBeDefined();

    expect(m.ocpClient.namespaces.OpenCapTableReports.members.companyValuationReport).toBeDefined();
    expect(m.ocpClient.namespaces.CouponMinter.members.canMintCouponsNow).toBeDefined();
    expect(m.ocpClient.namespaces.CantonPayments.members.airdrop).toBeDefined();
    expect(m.ocpClient.namespaces.PaymentStreams.members.activePaymentStream).toBeDefined();

    const batchMethods = new Set([...m.capTableBatch.publicMethods, ...m.capTableBatch.publicAsyncMethods]);
    expect(batchMethods).toEqual(
      new Set(['create', 'edit', 'delete', 'build', 'execute', 'getDetailedSummary', 'clear'])
    );
  });

  it('lists OpenCapTable entity modules aligned with src/functions/OpenCapTable/index.ts', () => {
    const m = buildReferenceManifest();
    const cat = m.categories.find((c) => c.id === 'openCapTableModules');
    expect(cat).toBeDefined();
    const modulePaths = cat?.exports?.modules.map((x) => x.modulePath) ?? [];
    expect(modulePaths.some((p) => p.includes('/stakeholder/'))).toBe(true);
    expect(modulePaths.some((p) => p.includes('/capTable/'))).toBe(true);
    expect(modulePaths.length).toBeGreaterThan(40);
  });
});
