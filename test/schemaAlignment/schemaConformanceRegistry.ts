import type {
  ConditionalCoverageRegistration,
  CoverageReference,
  SemanticRefinement,
} from './schemaConformanceHarness';

const coreRuntime: CoverageReference = {
  file: 'test/schemaAlignment/coreConditionalShapes.test.ts',
  kind: 'runtime',
  target: 'core schema conditional shapes',
};

function coreTypes(target: string): CoverageReference {
  return { file: 'test/types/coreSchemaShapes.types.ts', kind: 'type', target };
}

const enumRuntime: CoverageReference = {
  file: 'test/schemaAlignment/enumAlignment.test.ts',
  kind: 'runtime',
  target: 'OCF Enum Schema Alignment',
};

const convertibleRuntime: CoverageReference = {
  file: 'test/converters/conversionMechanismMatrix.test.ts',
  kind: 'runtime',
  target: 'canonical conversion mechanism matrices',
};

const warrantRuntime: CoverageReference = {
  file: 'test/converters/conversionMechanismMatrix.test.ts',
  kind: 'runtime',
  target: 'canonical conversion mechanism matrices',
};

const vestingRuntime: CoverageReference = {
  file: 'test/converters/valuationVestingConverters.test.ts',
  kind: 'runtime',
  target: 'VestingTerms Converters',
};

const equityCompensationRuntime: CoverageReference = {
  file: 'test/utils/typeGuards.test.ts',
  kind: 'runtime',
  target: 'OCF type guard schema soundness',
};

const schemaRefinementRuntime: CoverageReference = {
  file: 'test/schemaAlignment/schemaConformance.test.ts',
  kind: 'runtime',
  target: 'intentional SDK semantic refinements',
};

const ppsUpstreamGapRuntime: CoverageReference = {
  file: 'test/utils/conversionSemanticRefinements.test.ts',
  kind: 'runtime',
  target: 'typed and raw parsers reject PPS $name accepted by the upstream schema gap',
};

const ppsDiscountedRuntime: CoverageReference = {
  file: 'test/utils/conversionSemanticRefinements.test.ts',
  kind: 'runtime',
  target: 'typed and raw parsers reject discounted PPS $name',
};

function ppsSourceTypes(target: string): CoverageReference {
  return { file: 'test/types/conversionMechanisms.types.ts', kind: 'type', target };
}

function ppsBuiltTypes(target: string): CoverageReference {
  return { file: 'test/declarations/conversionMechanisms.types.ts', kind: 'type', target };
}

const ppsRefinementCoverage: CoverageReference[] = [
  ppsUpstreamGapRuntime,
  ppsDiscountedRuntime,
  ppsSourceTypes('ppsWithoutDiscount'),
  ppsSourceTypes('falseWithDetails'),
  ppsSourceTypes('trueWithoutDetails'),
  ppsSourceTypes('trueWithBothDetails'),
  ppsBuiltTypes('ppsWithoutDiscount'),
  ppsBuiltTypes('falseWithDetails'),
  ppsBuiltTypes('trueWithoutDetails'),
  ppsBuiltTypes('trueWithBothDetails'),
];

function registration(
  path: string,
  coverage: CoverageReference[],
  refinement?: string
): ConditionalCoverageRegistration {
  return refinement ? { coverage, path, refinement } : { coverage, path };
}

/**
 * Exact inventory of every conditional keyword reachable from an OCF object
 * schema. Each entry names a real runtime suite or compile-only type assertion.
 */
export const OCF_CONDITIONAL_COVERAGE: ConditionalCoverageRegistration[] = [
  registration('schema/objects/Document.schema.json#/oneOf', [coreRuntime, coreTypes('documentWithoutLocation')]),
  registration('schema/objects/Issuer.schema.json#/anyOf', [coreRuntime, coreTypes('issuerWithBothSubdivisions')]),
  registration('schema/objects/Issuer.schema.json#/anyOf/0/oneOf', [
    coreRuntime,
    coreTypes('issuerWithBothSubdivisions'),
  ]),
  registration('schema/objects/Issuer.schema.json#/anyOf/1/not', [
    coreRuntime,
    coreTypes('issuerWithBothSubdivisions'),
  ]),
  registration('schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf', [enumRuntime]),
  registration('schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf', [enumRuntime]),
  registration('schema/objects/StockPlan.schema.json#/oneOf', [coreRuntime, coreTypes('stockPlanWithEmptyClassIds')]),
  registration('schema/objects/StockPlan.schema.json#/oneOf/0/not', [
    coreRuntime,
    coreTypes('stockPlanWithEmptyClassIds'),
  ]),
  registration('schema/objects/StockPlan.schema.json#/oneOf/1/not', [
    coreRuntime,
    coreTypes('stockPlanWithEmptyClassIds'),
  ]),
  registration('schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf', [
    coreRuntime,
    coreTypes('relationshipWithoutChange'),
  ]),
  registration(
    'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf',
    [convertibleRuntime]
  ),
  registration('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf', [
    equityCompensationRuntime,
  ]),
  registration(
    'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf',
    [equityCompensationRuntime]
  ),
  registration(
    'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf',
    [warrantRuntime]
  ),
  registration(
    'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    [convertibleRuntime, warrantRuntime]
  ),
  registration(
    'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf',
    [warrantRuntime, schemaRefinementRuntime],
    'conversion-right-required-discriminator'
  ),
  registration('schema/types/ContactInfo.schema.json#/anyOf', [
    coreRuntime,
    coreTypes('namedContactWithoutCollection'),
  ]),
  registration('schema/types/ContactInfoWithoutName.schema.json#/anyOf', [
    coreRuntime,
    coreTypes('contactWithoutCollection'),
  ]),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf',
    ppsRefinementCoverage,
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not',
    ppsRefinementCoverage,
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not',
    ppsRefinementCoverage,
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not',
    ppsRefinementCoverage,
    'pps-discount-exclusivity'
  ),
  registration('schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf', [
    convertibleRuntime,
    warrantRuntime,
  ]),
  registration(
    'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    [convertibleRuntime]
  ),
  registration(
    'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    [warrantRuntime]
  ),
  registration(
    'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    [warrantRuntime]
  ),
  registration('schema/types/vesting/VestingCondition.schema.json#/oneOf', [
    coreRuntime,
    coreTypes('conditionWithoutAmount'),
    coreTypes('conditionWithBothAmounts'),
    vestingRuntime,
  ]),
  registration('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf', [vestingRuntime]),
  registration('schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf', [
    vestingRuntime,
  ]),
];

/**
 * Named, narrow differences from the pinned upstream schemas. These are not
 * generic exclusions: the guard tests the upstream loophole and the intended
 * SDK contract independently so either side changing requires review.
 */
export const EXPECTED_SEMANTIC_REFINEMENTS: SemanticRefinement[] = [
  {
    expectedSdkContract:
      'Canonical SDK conversion-right unions require their exact type discriminator before dispatching a nested mechanism.',
    id: 'conversion-right-required-discriminator',
    rationale:
      'The specialized upstream conversion-right schemas define a type const but omit type from required, so structurally ambiguous rights validate.',
    schemaPaths: [
      'schema/types/conversion_rights/ConvertibleConversionRight.schema.json',
      'schema/types/conversion_rights/StockClassConversionRight.schema.json',
      'schema/types/conversion_rights/WarrantConversionRight.schema.json',
    ],
  },
  {
    expectedSdkContract:
      'PPS semantics are discount=true with exactly one discount_percentage or discount_amount, or discount=false with neither field.',
    id: 'pps-discount-exclusivity',
    rationale:
      'The draft-07 PPS branches do not require discount and the discount=false branch only forbids both discount fields together, permitting one.',
    schemaPaths: ['schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json'],
  },
];

/** SHA-256 over every schema resource reachable from all pinned object schemas. */
export const PINNED_REACHABLE_SCHEMA_FINGERPRINT = '02c5b10358bbcef7ad8f34149c987109fffced2ee4b8b2ad652ac00e4bedc722';
