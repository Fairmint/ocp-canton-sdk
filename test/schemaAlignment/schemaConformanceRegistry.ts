import type { ConditionalCoverageRegistration, SemanticRefinement } from './schemaConformanceHarness';

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
    6
  ),
  ...alternatives('schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/anyOf', 6),
  ...alternatives(
    'schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json#/properties/expiration_date/oneOf',
    2
  ),
  ...alternatives(
    'schema/objects/transactions/issuance/WarrantIssuance.schema.json#/properties/exercise_triggers/items/anyOf',
    6
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
  ...alternatives('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf', 3),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/0/not'),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/1/not'),
  registration('schema/types/conversion_mechanisms/SharePriceBasedConversionMechanism.schema.json#/oneOf/2/not'),
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
];

/** SHA-256 over every schema resource reachable from all pinned object schemas. */
export const PINNED_REACHABLE_SCHEMA_FINGERPRINT = 'e1ac1de3030914e4d1c25872bb43f2dd4af2d0794a1d78180ad446cb2b941a56';
