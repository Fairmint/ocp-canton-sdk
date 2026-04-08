import {
  CURRENT_OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_ID,
  CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
  OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_REGISTRY,
  OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX,
  getOpenCapTableIssuerAuthorizationRegistryEntry,
  getOpenCapTableIssuerAuthorizationTemplateId,
  getOpenCapTableIssuerAuthorizationTemplateIds,
} from '../../src/functions/OpenCapTable';

describe('issuerAuthorizationRegistry', () => {
  it('exposes current-line IssuerAuthorization template id through public helper', () => {
    expect(getOpenCapTableIssuerAuthorizationTemplateId()).toBe(
      CURRENT_OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_ID
    );

    expect(getOpenCapTableIssuerAuthorizationRegistryEntry(CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE)).toEqual({
      packageLine: CURRENT_OPEN_CAP_TABLE_PACKAGE_LINE,
      templateId: CURRENT_OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_ID,
      isCurrent: true,
    });
  });

  it('builds known IssuerAuthorization template ids for legacy package lines', () => {
    expect(getOpenCapTableIssuerAuthorizationTemplateId('OpenCapTable-v30')).toBe(
      '#OpenCapTable-v30:Fairmint.OpenCapTable.IssuerAuthorization:IssuerAuthorization'
    );

    expect(getOpenCapTableIssuerAuthorizationTemplateIds(['OpenCapTable-v25', 'OpenCapTable-v33'])).toEqual([
      `#OpenCapTable-v25:${OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX}`,
      `#OpenCapTable-v33:${OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX}`,
    ]);

    expect(OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageLine: 'OpenCapTable-v25',
          templateId: `#OpenCapTable-v25:${OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX}`,
          isCurrent: false,
        }),
        expect.objectContaining({
          packageLine: 'OpenCapTable-v30',
          templateId: `#OpenCapTable-v30:${OPEN_CAP_TABLE_ISSUER_AUTHORIZATION_TEMPLATE_SUFFIX}`,
          isCurrent: false,
        }),
      ])
    );
  });
});
