import type {
  ConditionalCoverageRegistration,
  CoverageReference,
  SemanticRefinement,
} from './schemaConformanceHarness';

const coreAcceptRuntime: CoverageReference = {
  file: 'test/schemaAlignment/coreConditionalShapes.test.ts',
  kind: 'runtime',
  target: 'accepts $name',
};

const coreRejectRuntime: CoverageReference = {
  file: 'test/schemaAlignment/coreConditionalShapes.test.ts',
  kind: 'runtime',
  target: 'rejects $name',
};

function coreTypes(target: string): CoverageReference {
  return { file: 'test/types/coreSchemaShapes.types.ts', kind: 'type', target };
}

function conditionalBranchRuntime(target: string): CoverageReference {
  return {
    file: 'test/schemaAlignment/conditionalBranchCoverage.test.ts',
    kind: 'runtime',
    target,
  };
}

function alternatives(
  path: string,
  branchCoverage: ReadonlyArray<CoverageReference | readonly CoverageReference[]>,
  outsideCoverage: CoverageReference | readonly CoverageReference[],
  refinement?: string
): ConditionalCoverageRegistration[] {
  const registrations = branchCoverage.map((coverage, index) =>
    registration(`${path}/${index}`, Array.isArray(coverage) ? [...coverage] : [coverage], refinement)
  );
  const outside = Array.isArray(outsideCoverage) ? [...outsideCoverage] : [outsideCoverage];
  registrations.push(registration(`${path}/$outside`, outside, refinement));
  return registrations;
}

function repeatedBranches(count: number, coverage: CoverageReference): CoverageReference[] {
  return Array.from({ length: count }, () => coverage);
}

const issuerInitialSharesRuntime = [
  conditionalBranchRuntime('accepts Issuer AuthorizedShares initial_shares_authorized branch'),
  conditionalBranchRuntime('accepts Issuer Numeric initial_shares_authorized branch'),
];

const stockClassInitialSharesRuntime = [
  conditionalBranchRuntime('accepts StockClass AuthorizedShares initial_shares_authorized branch'),
  conditionalBranchRuntime('accepts StockClass Numeric initial_shares_authorized branch'),
];

const convertibleTriggerRuntime = [
  conditionalBranchRuntime('accepts ConvertibleIssuance AUTOMATIC_ON_CONDITION trigger branch'),
  conditionalBranchRuntime('accepts ConvertibleIssuance AUTOMATIC_ON_DATE trigger branch'),
  conditionalBranchRuntime('accepts ConvertibleIssuance ELECTIVE_AT_WILL trigger branch'),
  conditionalBranchRuntime('accepts ConvertibleIssuance ELECTIVE_IN_RANGE trigger branch'),
  conditionalBranchRuntime('accepts ConvertibleIssuance ELECTIVE_ON_CONDITION trigger branch'),
  conditionalBranchRuntime('accepts ConvertibleIssuance UNSPECIFIED trigger branch'),
];

const equityCompensationBranches = conditionalBranchRuntime(
  'accepts EquityCompensationIssuance $compensation_type branch'
);
const equityCompensationOutside = conditionalBranchRuntime(
  'rejects EquityCompensationIssuance outside every compensation anyOf branch'
);
const equityExpirationBranches = conditionalBranchRuntime(
  'accepts EquityCompensationIssuance expiration_date branch %#'
);
const equityExpirationOutside = conditionalBranchRuntime(
  'rejects EquityCompensationIssuance expiration_date outside both oneOf branches'
);
const warrantTriggerBranches = conditionalBranchRuntime('accepts WarrantIssuance $type exercise-trigger branch');
const warrantTriggerOutside = conditionalBranchRuntime('rejects a WarrantIssuance trigger outside every anyOf branch');
const conversionMechanismBranches = conditionalBranchRuntime(
  'accepts ConversionRight $type conversion_mechanism branch'
);
const conversionMechanismOutside = conditionalBranchRuntime(
  'rejects ConversionRight conversion_mechanism outside every oneOf branch'
);
const conversionRightBranches = conditionalBranchRuntime(
  'accepts ConversionTrigger $rightType conversion_right branch'
);
const conversionRightOutside = conditionalBranchRuntime(
  'rejects ConversionTrigger conversion_right outside every oneOf branch'
);
const specializedConversionBranches = conditionalBranchRuntime(
  'accepts $right $mechanismType conversion_mechanism branch'
);
const specializedConversionOutside = conditionalBranchRuntime(
  'rejects $right conversion_mechanism outside every oneOf branch'
);
const ppsBranches = conditionalBranchRuntime('accepts SharePriceBasedConversionMechanism $label branch');
const ppsOutside = conditionalBranchRuntime('rejects SharePriceBasedConversionMechanism outside every oneOf branch');
const valuationBranches = conditionalBranchRuntime('accepts ValuationBasedConversionMechanism $valuation_type branch');
const valuationOutside = conditionalBranchRuntime(
  'rejects ValuationBasedConversionMechanism outside every oneOf branch'
);
const vestingAmountBranches = conditionalBranchRuntime('accepts VestingCondition amount branch %#');
const vestingAmountOutside = conditionalBranchRuntime('rejects VestingCondition outside both amount oneOf branches');
const vestingTriggerBranches = conditionalBranchRuntime('accepts VestingCondition $type trigger branch');
const vestingTriggerOutside = conditionalBranchRuntime('rejects VestingCondition trigger outside every oneOf branch');
const vestingPeriodBranches = conditionalBranchRuntime('accepts VestingScheduleRelativeTrigger $type period branch');
const vestingPeriodOutside = conditionalBranchRuntime(
  'rejects VestingScheduleRelativeTrigger period outside both oneOf branches'
);

const schemaRefinementRuntime: CoverageReference = {
  file: 'test/schemaAlignment/schemaConformance.test.ts',
  kind: 'runtime',
  target: 'keeps conversion-right discriminators required despite the upstream omission',
};

const stockPlanSingularRuntime = conditionalBranchRuntime(
  'accepts StockPlan deprecated stock_class_id branch at raw ingestion'
);
const stockPlanCanonicalRuntime = conditionalBranchRuntime('accepts StockPlan canonical stock_class_ids branch');
const stockPlanOutsideRuntime = conditionalBranchRuntime('rejects StockPlan $label outside both oneOf branches');
const stockPlanRefinementRuntime: CoverageReference = {
  file: 'test/schemaAlignment/schemaConformance.test.ts',
  kind: 'runtime',
  target: 'keeps canonical StockPlan typing plural while raw ingestion accepts the deprecated singular branch',
};

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
  ...alternatives('schema/objects/Document.schema.json#/oneOf', repeatedBranches(2, coreAcceptRuntime), [
    coreRejectRuntime,
    coreTypes('documentWithoutLocation'),
  ]),
  ...alternatives('schema/objects/Issuer.schema.json#/anyOf', repeatedBranches(2, coreAcceptRuntime), [
    coreRejectRuntime,
    coreTypes('issuerWithBothSubdivisions'),
  ]),
  ...alternatives('schema/objects/Issuer.schema.json#/anyOf/0/oneOf', repeatedBranches(2, coreAcceptRuntime), [
    coreRejectRuntime,
    coreTypes('issuerWithBothSubdivisions'),
  ]),
  registration('schema/objects/Issuer.schema.json#/anyOf/1/not', [
    coreRejectRuntime,
    coreTypes('issuerWithBothSubdivisions'),
  ]),
  ...alternatives(
    'schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf',
    issuerInitialSharesRuntime,
    conditionalBranchRuntime('rejects $label initial_shares_authorized outside both oneOf branches')
  ),
  ...alternatives(
    'schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf',
    stockClassInitialSharesRuntime,
    conditionalBranchRuntime('rejects $label initial_shares_authorized outside both oneOf branches')
  ),
  ...alternatives(
    'schema/objects/StockPlan.schema.json#/oneOf',
    [[stockPlanSingularRuntime, coreTypes('stockPlanWithDeprecatedClassId')], stockPlanCanonicalRuntime],
    [stockPlanOutsideRuntime, coreTypes('stockPlanWithEmptyClassIds'), stockPlanRefinementRuntime],
    'stock-plan-canonical-class-ids'
  ),
  registration(
    'schema/objects/StockPlan.schema.json#/oneOf/0/not',
    [stockPlanSingularRuntime, stockPlanOutsideRuntime],
    'stock-plan-canonical-class-ids'
  ),
  registration(
    'schema/objects/StockPlan.schema.json#/oneOf/1/not',
    [stockPlanCanonicalRuntime, stockPlanOutsideRuntime],
    'stock-plan-canonical-class-ids'
  ),
  ...alternatives(
    'schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf',
    repeatedBranches(2, coreAcceptRuntime),
    [coreRejectRuntime, coreTypes('relationshipWithoutChange')]
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf',
    convertibleTriggerRuntime,
    conditionalBranchRuntime('rejects a ConvertibleIssuance trigger outside every anyOf branch')
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf',
    repeatedBranches(6, equityCompensationBranches),
    equityCompensationOutside
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf',
    repeatedBranches(2, equityExpirationBranches),
    equityExpirationOutside
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf',
    repeatedBranches(6, warrantTriggerBranches),
    warrantTriggerOutside
  ),
  ...alternatives(
    'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    repeatedBranches(8, conversionMechanismBranches),
    conversionMechanismOutside
  ),
  ...alternatives(
    'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf',
    repeatedBranches(3, conversionRightBranches),
    [conversionRightOutside, schemaRefinementRuntime],
    'conversion-right-required-discriminator'
  ),
  ...alternatives('schema/types/ContactInfo.schema.json#/anyOf', repeatedBranches(2, coreAcceptRuntime), [
    coreRejectRuntime,
    coreTypes('namedContactWithoutCollection'),
  ]),
  ...alternatives('schema/types/ContactInfoWithoutName.schema.json#/anyOf', repeatedBranches(2, coreAcceptRuntime), [
    coreRejectRuntime,
    coreTypes('contactWithoutCollection'),
  ]),
  ...alternatives(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf',
    repeatedBranches(3, ppsBranches),
    ppsOutside
  ),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not', [
    ppsBranches,
    ppsOutside,
  ]),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not', [
    ppsBranches,
    ppsOutside,
  ]),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not', [
    ppsBranches,
    ppsOutside,
  ]),
  ...alternatives(
    'schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf',
    repeatedBranches(3, valuationBranches),
    valuationOutside
  ),
  ...alternatives(
    'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    repeatedBranches(5, specializedConversionBranches),
    specializedConversionOutside
  ),
  ...alternatives(
    'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    repeatedBranches(1, specializedConversionBranches),
    specializedConversionOutside
  ),
  ...alternatives(
    'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    repeatedBranches(5, specializedConversionBranches),
    specializedConversionOutside
  ),
  ...alternatives(
    'schema/types/vesting/VestingCondition.schema.json#/oneOf',
    repeatedBranches(2, vestingAmountBranches),
    [vestingAmountOutside, coreTypes('conditionWithoutAmount'), coreTypes('conditionWithBothAmounts')]
  ),
  ...alternatives(
    'schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf',
    repeatedBranches(4, vestingTriggerBranches),
    vestingTriggerOutside
  ),
  ...alternatives(
    'schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf',
    repeatedBranches(2, vestingPeriodBranches),
    vestingPeriodOutside
  ),
];

/**
 * Named, narrow differences from the pinned upstream schemas. These are not
 * generic exclusions: the guard tests the upstream loophole and the intended
 * SDK contract independently so either side changing requires review.
 */
export const EXPECTED_SEMANTIC_REFINEMENTS: SemanticRefinement[] = [
  {
    expectedSdkContract:
      'Raw ingestion normalizes deprecated stock_class_id, while canonical OcfStockPlan requires a non-empty stock_class_ids tuple.',
    id: 'stock-plan-canonical-class-ids',
    rationale:
      'The pinned schema retains a singular compatibility branch, but the canonical SDK deliberately exposes only the plural v2 shape.',
    schemaPaths: ['schema/objects/StockPlan.schema.json'],
  },
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
];

/** SHA-256 over every schema resource reachable from all pinned object schemas. */
export const PINNED_REACHABLE_SCHEMA_FINGERPRINT = 'e1ac1de3030914e4d1c25872bb43f2dd4af2d0794a1d78180ad446cb2b941a56';
