import packageJson from '../../package.json';
import * as sdk from '../../src';

describe('package root exports', () => {
  it('exports only the SDK root and package metadata subpaths', () => {
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.js',
        default: './dist/index.js',
      },
      './package.json': './package.json',
    });
  });

  it('exposes only the curated high-level runtime surface', () => {
    expect(Object.keys(sdk).sort()).toEqual([
      'CUSTOM_PRESET',
      'CapTableBatch',
      'DEVNET_PRESET',
      'ENVIRONMENT_PRESETS',
      'LOCALNET_PRESET',
      'MAINNET_PRESET',
      'OCF_OBJECT_TYPE_TO_ENTITY_TYPE',
      'OcpClient',
      'OcpContextManager',
      'OcpContractError',
      'OcpError',
      'OcpErrorCodes',
      'OcpNetworkError',
      'OcpParseError',
      'OcpValidationError',
      'SCRATCHNET_PRESET',
      'STAGING_PRESET',
      'STAKEHOLDER_RELATIONSHIP_TYPES',
      'TESTNET_PRESET',
      'applyCommandContext',
      'authorizeIssuer',
      'buildCreateIssuerCommand',
      'buildUpdateCapTableCommand',
      'countManifestObjects',
      'createSharedSecretTokenGenerator',
      'detectEnvironment',
      'extractCantonOcfManifest',
      'isContractId',
      'isOcfCreatableEntityType',
      'isOcfDeletableEntityType',
      'isOcfEditableEntityType',
      'isOcfEntityType',
      'isOcfId',
      'isOcfReadableObjectType',
      'isPartyId',
      'isSecurityId',
      'loadEnvironmentConfigFromEnv',
      'mapOcfObjectTypeToEntityType',
      'mergeCommandContext',
      'resolveEnvironmentConfig',
      'sortTransactions',
      'submitObservedTransactionTree',
      'toCantonConfig',
      'toCantonNetwork',
      'toContractId',
      'toOcfId',
      'toPartyId',
      'toResolvedCantonConfig',
      'toSecurityId',
      'validateConfig',
      'withdrawAuthorization',
    ]);
  });

  it('exports an immutable canonical stakeholder relationship tuple', () => {
    expect(Object.isFrozen(sdk.STAKEHOLDER_RELATIONSHIP_TYPES)).toBe(true);
    expect(sdk.STAKEHOLDER_RELATIONSHIP_TYPES).toEqual([
      'ADVISOR',
      'BOARD_MEMBER',
      'CONSULTANT',
      'EMPLOYEE',
      'EX_ADVISOR',
      'EX_CONSULTANT',
      'EX_EMPLOYEE',
      'EXECUTIVE',
      'FOUNDER',
      'INVESTOR',
      'NON_US_EMPLOYEE',
      'OFFICER',
      'OTHER',
    ]);
    expect(() => (sdk.STAKEHOLDER_RELATIONSHIP_TYPES as unknown as string[]).push('LEGACY_RELATIONSHIP')).toThrow(
      TypeError
    );
  });
});
