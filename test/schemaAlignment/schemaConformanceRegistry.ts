import type {
  CanonicalPropertyParityExclusion,
  ConditionalCoverageRegistration,
  PinnedOcfNonEmptyArrayInventoryEntry,
  PinnedOcfUniqueArrayInventoryEntry,
  SemanticRefinement,
} from './schemaConformanceHarness';

/** Pinned compatibility wrappers deliberately excluded from the canonical SDK surface. */
export const RETIRED_PLAN_SECURITY_SCHEMA_PAIRS = [
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_ACCEPTANCE',
    retiredDiscriminator: 'TX_PLAN_SECURITY_ACCEPTANCE',
    wrapperSchemaPath: 'schema/objects/transactions/acceptance/PlanSecurityAcceptance.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_CANCELLATION',
    retiredDiscriminator: 'TX_PLAN_SECURITY_CANCELLATION',
    wrapperSchemaPath: 'schema/objects/transactions/cancellation/PlanSecurityCancellation.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_EXERCISE',
    retiredDiscriminator: 'TX_PLAN_SECURITY_EXERCISE',
    wrapperSchemaPath: 'schema/objects/transactions/exercise/PlanSecurityExercise.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    retiredDiscriminator: 'TX_PLAN_SECURITY_ISSUANCE',
    wrapperSchemaPath: 'schema/objects/transactions/issuance/PlanSecurityIssuance.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_RELEASE',
    retiredDiscriminator: 'TX_PLAN_SECURITY_RELEASE',
    wrapperSchemaPath: 'schema/objects/transactions/release/PlanSecurityRelease.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_RETRACTION',
    retiredDiscriminator: 'TX_PLAN_SECURITY_RETRACTION',
    wrapperSchemaPath: 'schema/objects/transactions/retraction/PlanSecurityRetraction.schema.json',
  },
  {
    canonicalDiscriminator: 'TX_EQUITY_COMPENSATION_TRANSFER',
    retiredDiscriminator: 'TX_PLAN_SECURITY_TRANSFER',
    wrapperSchemaPath: 'schema/objects/transactions/transfer/PlanSecurityTransfer.schema.json',
  },
] as const;

/** Deliberate public DTO differences from the pinned top-level object schemas. */
export const CANONICAL_PROPERTY_PARITY_EXCLUSIONS: CanonicalPropertyParityExclusion[] = [
  {
    discriminator: 'STAKEHOLDER',
    kind: 'schema-only',
    property: 'current_relationship',
    rationale:
      'The pinned schema marks current_relationship deprecated; the canonical SDK intentionally requires current_relationships instead.',
  },
  {
    discriminator: 'STOCK_PLAN',
    kind: 'schema-only',
    property: 'stock_class_id',
    rationale:
      'The pinned schema retains deprecated singular stock_class_id; the canonical SDK exposes only stock_class_ids.',
  },
  {
    discriminator: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    kind: 'schema-only',
    property: 'option_grant_type',
    rationale:
      'The pinned schema retains deprecated option_grant_type; the canonical SDK models the grant through compensation_type.',
  },
];

/** Exact pinned canonical top-level array properties whose schema requires at least one item. */
export const PINNED_CANONICAL_NON_EMPTY_ARRAYS: PinnedOcfNonEmptyArrayInventoryEntry[] = [
  {
    discriminator: 'FINANCING',
    minItems: 1,
    property: 'issuance_ids',
    schemaPath: 'schema/objects/Financing.schema.json',
  },
  {
    discriminator: 'STOCK_PLAN',
    minItems: 1,
    property: 'stock_class_ids',
    schemaPath: 'schema/objects/StockPlan.schema.json',
  },
  {
    discriminator: 'TX_CONVERTIBLE_ISSUANCE',
    minItems: 1,
    property: 'conversion_triggers',
    schemaPath: 'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json',
  },
  {
    discriminator: 'TX_CONVERTIBLE_TRANSFER',
    minItems: 1,
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/ConvertibleTransfer.schema.json',
  },
  {
    discriminator: 'TX_EQUITY_COMPENSATION_ISSUANCE',
    minItems: 1,
    property: 'vestings',
    schemaPath: 'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json',
  },
  {
    discriminator: 'TX_EQUITY_COMPENSATION_TRANSFER',
    minItems: 1,
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/EquityCompensationTransfer.schema.json',
  },
  {
    discriminator: 'TX_STOCK_CONSOLIDATION',
    minItems: 1,
    property: 'security_ids',
    schemaPath: 'schema/objects/transactions/consolidation/StockConsolidation.schema.json',
  },
  {
    discriminator: 'TX_STOCK_ISSUANCE',
    minItems: 1,
    property: 'vestings',
    schemaPath: 'schema/objects/transactions/issuance/StockIssuance.schema.json',
  },
  {
    discriminator: 'TX_STOCK_TRANSFER',
    minItems: 1,
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/StockTransfer.schema.json',
  },
  {
    discriminator: 'TX_WARRANT_ISSUANCE',
    minItems: 1,
    property: 'vestings',
    schemaPath: 'schema/objects/transactions/issuance/WarrantIssuance.schema.json',
  },
  {
    discriminator: 'TX_WARRANT_TRANSFER',
    minItems: 1,
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/WarrantTransfer.schema.json',
  },
  {
    discriminator: 'VESTING_TERMS',
    minItems: 1,
    property: 'vesting_conditions',
    schemaPath: 'schema/objects/VestingTerms.schema.json',
  },
];

/** Exact pinned canonical top-level arrays whose schema requires unique items. */
export const PINNED_CANONICAL_UNIQUE_ARRAYS: PinnedOcfUniqueArrayInventoryEntry[] = [
  {
    discriminator: 'TX_CONVERTIBLE_TRANSFER',
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/ConvertibleTransfer.schema.json',
  },
  {
    discriminator: 'TX_EQUITY_COMPENSATION_TRANSFER',
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/EquityCompensationTransfer.schema.json',
  },
  {
    discriminator: 'TX_STOCK_CONSOLIDATION',
    property: 'security_ids',
    schemaPath: 'schema/objects/transactions/consolidation/StockConsolidation.schema.json',
  },
  {
    discriminator: 'TX_STOCK_TRANSFER',
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/StockTransfer.schema.json',
  },
  {
    discriminator: 'TX_WARRANT_TRANSFER',
    property: 'resulting_security_ids',
    schemaPath: 'schema/objects/transactions/transfer/WarrantTransfer.schema.json',
  },
];

/** Deliberate SDK non-empty refinements beyond the pinned schema's array cardinality. */
export const EXPECTED_NON_EMPTY_ARRAY_REFINEMENTS = [
  {
    discriminator: 'TX_CONVERTIBLE_CONVERSION',
    kind: 'sdk-only' as const,
    property: 'resulting_security_ids',
    rationale:
      'A completed convertible conversion must create at least one resulting security even though the pinned primitive schema omits minItems.',
  },
] as const;

const CONDITIONAL_WITNESS_FILE = 'test/schemaAlignment/conditionalBranchWitnesses.test.ts';

function registration(path: string, refinement?: string): ConditionalCoverageRegistration {
  const coverage = [{ file: CONDITIONAL_WITNESS_FILE, kind: 'runtime' as const, target: `covers ${path}` }];
  return refinement ? { coverage, path, refinement } : { coverage, path };
}

function alternatives(path: string, branchCount: number, refinement?: string): ConditionalCoverageRegistration[] {
  return [
    ...Array.from({ length: branchCount }, (_unused, index) => registration(`${path}/${index}`, refinement)),
    registration(`${path}/$outside`, refinement),
  ];
}

/**
 * Exact inventory of every conditional outcome reachable from an OCF object
 * schema. Every path maps one-to-one to a literal, executable Jest test title;
 * the validator rejects reuse, parameterized registrations, and dead scopes.
 */
export const OCF_CONDITIONAL_COVERAGE: ConditionalCoverageRegistration[] = [
  ...alternatives('schema/objects/Document.schema.json#/oneOf', 2),
  ...alternatives('schema/objects/Issuer.schema.json#/anyOf', 2),
  ...alternatives('schema/objects/Issuer.schema.json#/anyOf/0/oneOf', 2),
  registration('schema/objects/Issuer.schema.json#/anyOf/1/not'),
  ...alternatives('schema/objects/Issuer.schema.json#/properties/initial_shares_authorized/oneOf', 2),
  ...alternatives('schema/objects/StockClass.schema.json#/properties/initial_shares_authorized/oneOf', 2),
  ...alternatives('schema/objects/StockPlan.schema.json#/oneOf', 2, 'stock-plan-canonical-class-ids'),
  registration('schema/objects/StockPlan.schema.json#/oneOf/0/not', 'stock-plan-canonical-class-ids'),
  registration('schema/objects/StockPlan.schema.json#/oneOf/1/not', 'stock-plan-canonical-class-ids'),
  ...alternatives('schema/objects/transactions/change_event/StakeholderRelationshipChangeEvent.schema.json#/anyOf', 2),
  ...alternatives(
    'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json#/properties/conversion_triggers/items/anyOf',
    6,
    'conversion-trigger-semantic-integrity'
  ),
  ...alternatives('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf', 6),
  ...alternatives(
    'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf',
    2
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf',
    6,
    'conversion-trigger-semantic-integrity'
  ),
  ...alternatives(
    'schema/primitives/types/conversion_rights/ConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    8
  ),
  ...alternatives(
    'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json#/properties/conversion_right/oneOf',
    3,
    'conversion-right-required-discriminator'
  ),
  ...alternatives('schema/types/ContactInfo.schema.json#/anyOf', 2),
  ...alternatives('schema/types/ContactInfoWithoutName.schema.json#/anyOf', 2),
  ...alternatives(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf',
    3,
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not',
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not',
    'pps-discount-exclusivity'
  ),
  registration(
    'schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not',
    'pps-discount-exclusivity'
  ),
  ...alternatives('schema/types/conversion_mechanisms/ValuationBasedConversionMechanism.schema.json#/oneOf', 3),
  ...alternatives(
    'schema/types/conversion_rights/ConvertibleConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    5
  ),
  ...alternatives(
    'schema/types/conversion_rights/StockClassConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    1
  ),
  ...alternatives(
    'schema/types/conversion_rights/WarrantConversionRight.schema.json#/properties/conversion_mechanism/oneOf',
    5
  ),
  ...alternatives('schema/types/vesting/VestingCondition.schema.json#/oneOf', 2),
  ...alternatives('schema/types/vesting/VestingCondition.schema.json#/properties/trigger/oneOf', 4),
  ...alternatives('schema/types/vesting/VestingScheduleRelativeTrigger.schema.json#/properties/period/oneOf', 2),
];

/**
 * Named, narrow differences from the pinned upstream schemas. These are not
 * generic exclusions: the guard tests the upstream loophole and the intended
 * SDK contract independently so either side changing requires review.
 */
export const EXPECTED_SEMANTIC_REFINEMENTS: SemanticRefinement[] = [
  {
    coverage: [
      {
        file: 'test/utils/conversionSemanticRefinements.test.ts',
        kind: 'runtime',
        target: 'rejects schema-valid duplicate conversion trigger IDs at typed boundaries',
      },
      {
        file: 'test/utils/conversionSemanticRefinements.test.ts',
        kind: 'runtime',
        target: 'rejects schema-valid reversed elective conversion ranges at typed boundaries',
      },
    ],
    expectedSdkContract:
      'Typed convertible and warrant inputs require non-empty trigger IDs unique within the parent list and ELECTIVE_IN_RANGE end_date on or after start_date.',
    id: 'conversion-trigger-semantic-integrity',
    rationale:
      'The pinned schemas describe trigger IDs as unique and date ranges as ordered, but draft-07 validates neither cross-item uniqueness nor date ordering.',
    schemaPaths: [
      'schema/objects/transactions/issuance/ConvertibleIssuance.schema.json',
      'schema/objects/transactions/issuance/WarrantIssuance.schema.json',
      'schema/primitives/types/conversion_triggers/ConversionTrigger.schema.json',
      'schema/types/conversion_triggers/ElectiveConversionInDateRangeTrigger.schema.json',
    ],
  },
  {
    coverage: [
      {
        file: 'test/schemaAlignment/schemaConformance.test.ts',
        kind: 'runtime',
        target: 'keeps canonical StockPlan typing plural while raw ingestion accepts the deprecated singular branch',
      },
    ],
    expectedSdkContract:
      'Raw ingestion normalizes deprecated stock_class_id, while canonical OcfStockPlan requires a non-empty stock_class_ids tuple.',
    id: 'stock-plan-canonical-class-ids',
    rationale:
      'The pinned schema retains a singular compatibility branch, but the canonical SDK deliberately exposes only the plural v2 shape.',
    schemaPaths: ['schema/objects/StockPlan.schema.json'],
  },
  {
    coverage: [
      {
        file: 'test/schemaAlignment/schemaConformance.test.ts',
        kind: 'runtime',
        target: 'keeps conversion-right discriminators required despite the upstream omission',
      },
    ],
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
    coverage: [
      {
        file: 'test/schemaAlignment/schemaConformance.test.ts',
        kind: 'runtime',
        target: 'enforces PPS discount exclusivity beyond the pinned draft-07 schema gap',
      },
      { file: 'test/types/conversionMechanisms.types.ts', kind: 'type', target: 'ppsWithoutDiscount' },
      { file: 'test/types/conversionMechanisms.types.ts', kind: 'type', target: 'falseWithDetails' },
      { file: 'test/types/conversionMechanisms.types.ts', kind: 'type', target: 'trueWithoutDetails' },
      { file: 'test/types/conversionMechanisms.types.ts', kind: 'type', target: 'trueWithBothDetails' },
      { file: 'test/declarations/conversionMechanisms.types.ts', kind: 'type', target: 'ppsWithoutDiscount' },
      { file: 'test/declarations/conversionMechanisms.types.ts', kind: 'type', target: 'falseWithDetails' },
      { file: 'test/declarations/conversionMechanisms.types.ts', kind: 'type', target: 'trueWithoutDetails' },
      { file: 'test/declarations/conversionMechanisms.types.ts', kind: 'type', target: 'trueWithBothDetails' },
    ],
    expectedSdkContract:
      'PPS semantics are discount=true with exactly one discount_percentage or discount_amount, or discount=false with neither field.',
    id: 'pps-discount-exclusivity',
    rationale:
      'The draft-07 PPS branches do not require discount and the discount=false branch only forbids both discount fields together, permitting one.',
    schemaPaths: ['schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json'],
  },
];

/** SHA-256 over every schema resource reachable from all pinned object schemas. */
export const PINNED_REACHABLE_SCHEMA_FINGERPRINT = 'e1ac1de3030914e4d1c25872bb43f2dd4af2d0794a1d78180ad446cb2b941a56';
