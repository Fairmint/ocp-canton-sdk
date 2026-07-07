import { OCP_TEMPLATES, OPEN_CAP_TABLE_PACKAGE_NAME } from '../src/openCapTablePackage';

describe('openCapTablePackage', () => {
  it('defaults SDK templates to the in-wild OpenCapTable v34 package line', () => {
    expect(OPEN_CAP_TABLE_PACKAGE_NAME).toBe('OpenCapTable-v34');
    expect(OCP_TEMPLATES.capTable).toBe('#OpenCapTable-v34:Fairmint.OpenCapTable.CapTable:CapTable');
    expect(OCP_TEMPLATES.issuerAuthorization).toBe(
      '#OpenCapTable-v34:Fairmint.OpenCapTable.IssuerAuthorization:IssuerAuthorization'
    );
    expect(OCP_TEMPLATES.ocpFactory).toBe('#OpenCapTable-v34:Fairmint.OpenCapTable.OcpFactory:OcpFactory');
  });
});
