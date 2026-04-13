import { OcpContractError } from '../../src/errors';
import {
  assertTemplateIdentity,
  compareTemplateIdentity,
  matchesTemplateIdentity,
  parseTemplateIdentity,
} from '../../src/utils/templateIdentity';

describe('templateIdentity', () => {
  it('parses package name and module/entity path', () => {
    expect(parseTemplateIdentity('#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer')).toEqual({
      templateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
      packageRef: '#pkg-name',
      packageName: 'pkg-name',
      moduleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
    });
  });

  it('matches by module/entity path plus explicit packageName', () => {
    expect(
      matchesTemplateIdentity(
        {
          templateId: '00deadbeef:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
          packageName: 'pkg-name',
        },
        '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer'
      )
    ).toBe(true);
  });

  it('reports package name mismatch when module/entity path matches', () => {
    expect(
      compareTemplateIdentity(
        {
          templateId: '00deadbeef:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
          packageName: 'wrong-package',
        },
        '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer'
      )
    ).toMatchObject({
      matches: false,
      mismatch: 'package_name_mismatch',
    });
  });

  it('throws structured contract error on mismatch', () => {
    expect(() =>
      assertTemplateIdentity(
        {
          templateId: '#pkg-name:Fairmint.OpenCapTable.OCF.StockClass:StockClass',
          packageName: 'pkg-name',
        },
        '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        {
          contractId: 'cid-123',
          operation: 'readIssuer',
        }
      )
    ).toThrow(OcpContractError);

    try {
      assertTemplateIdentity(
        {
          templateId: '#pkg-name:Fairmint.OpenCapTable.OCF.StockClass:StockClass',
          packageName: 'pkg-name',
        },
        '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        {
          contractId: 'cid-123',
          operation: 'readIssuer',
        }
      );
      throw new Error('expected assertTemplateIdentity to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OcpContractError);
      const ocpError = error as OcpContractError;
      expect(ocpError.code).toBe('SCHEMA_MISMATCH');
      expect(ocpError.classification).toBe('module_entity_mismatch');
      expect(ocpError.context).toMatchObject({
        operation: 'readIssuer',
        actualTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.StockClass:StockClass',
        expectedTemplateId: '#pkg-name:Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        expectedPackageName: 'pkg-name',
        expectedModuleEntityPath: 'Fairmint.OpenCapTable.OCF.Issuer:Issuer',
        actualModuleEntityPath: 'Fairmint.OpenCapTable.OCF.StockClass:StockClass',
      });
    }
  });
});
