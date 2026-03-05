import fs from 'fs';
import path from 'path';

const NATIVE_TS_PATH = path.join(__dirname, '../../src/types/native.ts');

interface SchemaMapping {
  schemaFile: string;
  sdkInterface: string;
  requiredFields: string[];
  optionalFields: string[];
}

const SCHEMA_MAPPINGS: SchemaMapping[] = [
  {
    schemaFile: 'Issuer.schema.json',
    sdkInterface: 'OcfIssuer',
    requiredFields: ['id', 'legal_name', 'formation_date', 'country_of_formation', 'tax_ids'],
    optionalFields: [
      'comments',
      'address',
      'country_subdivision_of_formation',
      'country_subdivision_name_of_formation',
      'dba',
      'email',
      'initial_shares_authorized',
      'phone',
    ],
  },
  {
    schemaFile: 'Stakeholder.schema.json',
    sdkInterface: 'OcfStakeholder',
    requiredFields: ['id', 'name', 'stakeholder_type'],
    optionalFields: [
      'comments',
      'issuer_assigned_id',
      'current_relationship',
      'current_relationships',
      'current_status',
      'primary_contact',
      'contact_info',
      'addresses',
      'tax_ids',
    ],
  },
  {
    schemaFile: 'StockClass.schema.json',
    sdkInterface: 'OcfStockClass',
    requiredFields: [
      'id',
      'name',
      'class_type',
      'default_id_prefix',
      'initial_shares_authorized',
      'votes_per_share',
      'seniority',
    ],
    optionalFields: [
      'comments',
      'conversion_rights',
      'board_approval_date',
      'stockholder_approval_date',
      'par_value',
      'price_per_share',
      'liquidation_preference_multiple',
      'participation_cap_multiple',
    ],
  },
  {
    schemaFile: 'StockPlan.schema.json',
    sdkInterface: 'OcfStockPlan',
    requiredFields: ['id', 'plan_name', 'initial_shares_reserved'],
    optionalFields: [
      'comments',
      'board_approval_date',
      'stockholder_approval_date',
      'default_cancellation_behavior',
      'stock_class_id',
      'stock_class_ids',
    ],
  },
  {
    schemaFile: 'VestingTerms.schema.json',
    sdkInterface: 'OcfVestingTerms',
    requiredFields: ['id', 'name', 'description', 'allocation_type', 'vesting_conditions'],
    optionalFields: ['comments'],
  },
  {
    schemaFile: 'Valuation.schema.json',
    sdkInterface: 'OcfValuation',
    requiredFields: ['id', 'stock_class_id', 'price_per_share', 'effective_date', 'valuation_type'],
    optionalFields: ['comments', 'provider', 'board_approval_date', 'stockholder_approval_date'],
  },
  {
    schemaFile: 'StockLegendTemplate.schema.json',
    sdkInterface: 'OcfStockLegendTemplate',
    requiredFields: ['id', 'name', 'text'],
    optionalFields: ['comments'],
  },
  {
    schemaFile: 'Document.schema.json',
    sdkInterface: 'OcfDocument',
    requiredFields: ['id', 'md5'],
    optionalFields: ['comments', 'path', 'uri', 'related_objects'],
  },
  // Transaction mappings
  {
    schemaFile: 'transactions/issuance/StockIssuance.schema.json',
    sdkInterface: 'OcfStockIssuance',
    requiredFields: [
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'stock_class_id',
      'share_price',
      'quantity',
    ],
    optionalFields: [
      'board_approval_date',
      'stockholder_approval_date',
      'consideration_text',
      'security_law_exemptions',
      'stock_plan_id',
      'share_numbers_issued',
      'vesting_terms_id',
      'vestings',
      'cost_basis',
      'stock_legend_ids',
      'issuance_type',
      'comments',
    ],
  },
  {
    schemaFile: 'transactions/issuance/EquityCompensationIssuance.schema.json',
    sdkInterface: 'OcfEquityCompensationIssuance',
    requiredFields: ['id', 'date', 'security_id', 'custom_id', 'stakeholder_id', 'compensation_type', 'quantity'],
    optionalFields: [
      'stock_plan_id',
      'stock_class_id',
      'board_approval_date',
      'stockholder_approval_date',
      'consideration_text',
      'vesting_terms_id',
      'exercise_price',
      'base_price',
      'early_exercisable',
      'security_law_exemptions',
      'vestings',
      'expiration_date',
      'termination_exercise_windows',
      'comments',
    ],
  },
  {
    schemaFile: 'transactions/issuance/ConvertibleIssuance.schema.json',
    sdkInterface: 'OcfConvertibleIssuance',
    requiredFields: [
      'id',
      'date',
      'security_id',
      'custom_id',
      'stakeholder_id',
      'investment_amount',
      'convertible_type',
      'conversion_triggers',
      'seniority',
    ],
    optionalFields: [
      'board_approval_date',
      'stockholder_approval_date',
      'consideration_text',
      'security_law_exemptions',
      'pro_rata',
      'comments',
    ],
  },
];

/** Extract interface body from native.ts source using brace counting. */
function extractInterfaceBody(source: string, interfaceName: string): string | null {
  const marker = `export interface ${interfaceName}`;
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) return null;
  let depth = 1;
  let i = openBrace + 1;
  while (depth > 0 && i < source.length) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return source.slice(openBrace + 1, i - 1);
}

/** Check that the interface body contains the given field (as a property declaration). */
function hasField(body: string, field: string): boolean {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldRegex = new RegExp(`\\b${escaped}\\b\\s*[?:]`);
  return fieldRegex.test(body);
}

describe('OCF Object Schema Field Alignment', () => {
  const nativeSource = fs.readFileSync(NATIVE_TS_PATH, 'utf-8');

  for (const mapping of SCHEMA_MAPPINGS) {
    describe(mapping.sdkInterface, () => {
      const body = extractInterfaceBody(nativeSource, mapping.sdkInterface);

      it('interface exists in native.ts', () => {
        expect(body).not.toBeNull();
      });

      if (body) {
        for (const field of mapping.requiredFields) {
          it(`has required field: ${field}`, () => {
            expect(hasField(body, field)).toBe(true);
          });
        }

        for (const field of mapping.optionalFields) {
          it(`has optional field: ${field}`, () => {
            expect(hasField(body, field)).toBe(true);
          });
        }
      }
    });
  }
});
