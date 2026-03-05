#!/usr/bin/env ts-node
/**
 * OCF Schema vs SDK TypeScript Interface Alignment Audit
 *
 * Compares OCF object schemas against SDK native.ts interfaces field-by-field.
 * Output: audit-field-report.md
 */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const OCF_OBJECTS = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', 'schema', 'objects');
const GITHUB_BASE = 'https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/';

interface SchemaProp {
  type?: string;
  $ref?: string;
  description?: string;
  items?: { type?: string; $ref?: string };
  oneOf?: unknown[];
  anyOf?: unknown[];
  enum?: unknown[];
  const?: unknown;
  minItems?: number;
  [key: string]: unknown;
}

interface JsonSchema {
  $id?: string;
  type?: string;
  properties?: Record<string, SchemaProp>;
  required?: string[];
  additionalProperties?: boolean;
  allOf?: Array<{ $ref: string }>;
  oneOf?: unknown[];
  anyOf?: unknown[];
}

/** Resolve $ref to local path and read schema */
function resolveRef(ref: string): JsonSchema | null {
  if (!ref.startsWith(GITHUB_BASE)) return null;
  const rel = ref.slice(GITHUB_BASE.length);
  const localPath = path.join(REPO_ROOT, 'libs', 'Open-Cap-Format-OCF', rel);
  if (!fs.existsSync(localPath)) return null;
  return JSON.parse(fs.readFileSync(localPath, 'utf8')) as JsonSchema;
}

/** Extract property type from schema (simplified - for refs we use the ref path) */
function getOcfType(prop: SchemaProp): string {
  if (prop.type) {
    if (prop.items?.$ref) return `array<${refToType(prop.items.$ref)}>`;
    if (prop.items?.type) return `array<${prop.items.type}>`;
    return prop.type;
  }
  if (prop.$ref) return refToType(prop.$ref);
  if (prop.oneOf) return 'oneOf';
  if (prop.anyOf) return 'anyOf';
  if (prop.enum) return `enum(${prop.enum.join('|')})`;
  if (prop.const !== undefined) {
    const c = prop.const;
    return typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean' ? `const:${c}` : 'const';
  }
  return 'unknown';
}

function refToType(ref: string): string {
  const name = ref.split('/').pop()?.replace('.schema.json', '') ?? 'ref';
  return name;
}

/** Collect all properties from a schema including allOf inheritance */
function collectSchemaProperties(schemaPath: string): {
  properties: Record<string, SchemaProp>;
  required: Set<string>;
  additionalProperties: boolean;
} {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(content) as JsonSchema;

  const properties: Record<string, SchemaProp> = {};
  const required = new Set<string>();
  let additionalProperties = schema.additionalProperties ?? true;

  function merge(s: JsonSchema): void {
    if (s.additionalProperties === false) additionalProperties = false;
    if (s.allOf) {
      for (const ref of s.allOf) {
        const refUrl = (ref as { $ref?: string }).$ref;
        if (refUrl) {
          const resolved = resolveRef(refUrl);
          if (resolved != null) merge(resolved);
        }
      }
    }
    if (s.properties) {
      for (const [k, v] of Object.entries(s.properties)) {
        if (v && typeof v === 'object' && Object.keys(v).length > 0) {
          properties[k] = v;
        }
      }
    }
    if (s.required) for (const r of s.required) required.add(r);
  }

  merge(schema);

  return { properties, required, additionalProperties };
}

/** Extract SDK interface fields from native.ts */
function extractSdkFields(interfaceName: string): Map<string, { type: string; required: boolean }> {
  const nativePath = path.join(REPO_ROOT, 'src', 'types', 'native.ts');
  const content = fs.readFileSync(nativePath, 'utf8');

  const fields = new Map<string, { type: string; required: boolean }>();

  const re = new RegExp(`export interface ${interfaceName}\\s*\\{([\\s\\S]*?)^}`, 'm');
  const match = content.match(re);
  if (!match) return fields;

  const body = match[1];
  const lines = body.split('\n');

  for (const line of lines) {
    const declMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??\s*:\s*(.+?);?\s*$/);
    if (declMatch) {
      const name = declMatch[1];
      const hasOptional = line.includes(`${name}?:`);
      const typeStr = declMatch[2].trim();
      const required = !hasOptional;
      fields.set(name, { type: typeStr, required });
    }
  }

  return fields;
}

/** Schema file to SDK interface mapping */
const SCHEMA_TO_SDK: Record<string, string> = {
  Issuer: 'OcfIssuer',
  Stakeholder: 'OcfStakeholder',
  StockClass: 'OcfStockClass',
  StockLegendTemplate: 'OcfStockLegendTemplate',
  StockPlan: 'OcfStockPlan',
  VestingTerms: 'OcfVestingTerms',
  Valuation: 'OcfValuation',
  Document: 'OcfDocument',
  Financing: 'OcfFinancing',
  StockIssuance: 'OcfStockIssuance',
  EquityCompensationIssuance: 'OcfEquityCompensationIssuance',
  ConvertibleIssuance: 'OcfConvertibleIssuance',
  WarrantIssuance: 'OcfWarrantIssuance',
  PlanSecurityIssuance: 'OcfPlanSecurityIssuance',
  StockCancellation: 'OcfStockCancellation',
  WarrantCancellation: 'OcfWarrantCancellation',
  ConvertibleCancellation: 'OcfConvertibleCancellation',
  EquityCompensationCancellation: 'OcfEquityCompensationCancellation',
  PlanSecurityCancellation: 'OcfPlanSecurityCancellation',
  StockTransfer: 'OcfStockTransfer',
  WarrantTransfer: 'OcfWarrantTransfer',
  ConvertibleTransfer: 'OcfConvertibleTransfer',
  EquityCompensationTransfer: 'OcfEquityCompensationTransfer',
  PlanSecurityTransfer: 'OcfPlanSecurityTransfer',
  StockAcceptance: 'OcfStockAcceptance',
  WarrantAcceptance: 'OcfWarrantAcceptance',
  ConvertibleAcceptance: 'OcfConvertibleAcceptance',
  EquityCompensationAcceptance: 'OcfEquityCompensationAcceptance',
  PlanSecurityAcceptance: 'OcfPlanSecurityAcceptance',
  StockRetraction: 'OcfStockRetraction',
  WarrantRetraction: 'OcfWarrantRetraction',
  ConvertibleRetraction: 'OcfConvertibleRetraction',
  EquityCompensationRetraction: 'OcfEquityCompensationRetraction',
  PlanSecurityRetraction: 'OcfPlanSecurityRetraction',
  StockConversion: 'OcfStockConversion',
  ConvertibleConversion: 'OcfConvertibleConversion',
  WarrantExercise: 'OcfWarrantExercise',
  EquityCompensationExercise: 'OcfEquityCompensationExercise',
  PlanSecurityExercise: 'OcfPlanSecurityExercise',
  EquityCompensationRelease: 'OcfEquityCompensationRelease',
  PlanSecurityRelease: 'OcfPlanSecurityRelease',
  VestingStart: 'OcfVestingStart',
  VestingEvent: 'OcfVestingEvent',
  VestingAcceleration: 'OcfVestingAcceleration',
  StockClassSplit: 'OcfStockClassSplit',
  StockClassConversionRatioAdjustment: 'OcfStockClassConversionRatioAdjustment',
  StockClassAuthorizedSharesAdjustment: 'OcfStockClassAuthorizedSharesAdjustment',
  StockPlanPoolAdjustment: 'OcfStockPlanPoolAdjustment',
  StockPlanReturnToPool: 'OcfStockPlanReturnToPool',
  IssuerAuthorizedSharesAdjustment: 'OcfIssuerAuthorizedSharesAdjustment',
  StockReissuance: 'OcfStockReissuance',
  StockConsolidation: 'OcfStockConsolidation',
  StockRepurchase: 'OcfStockRepurchase',
  EquityCompensationRepricing: 'OcfEquityCompensationRepricing',
  StakeholderRelationshipChangeEvent: 'OcfStakeholderRelationshipChangeEvent',
  StakeholderStatusChangeEvent: 'OcfStakeholderStatusChangeEvent',
};

/** OCF field name to SDK field name mappings (for known renames) */
const FIELD_ALIASES: Record<string, Record<string, string>> = {
  OcfFinancing: { name: 'round_name', date: 'financing_date' },
};

function findSdkField(
  sdkFields: Map<string, { type: string; required: boolean }>,
  ocfName: string,
  sdkInterface: string
): string | null {
  if (sdkFields.has(ocfName)) return ocfName;
  const aliases = FIELD_ALIASES[sdkInterface];
  const aliasMap = aliases ?? {};
  if (ocfName in aliasMap) return aliasMap[ocfName];
  return null;
}

function compareTypes(ocfType: string, sdkType: string): 'OK' | 'MISMATCH' {
  const o = ocfType.toLowerCase();
  const s = sdkType.toLowerCase();
  if (o === s) return 'OK';
  if (o === 'string' && (s.includes('string') || s.includes('number'))) return 'OK';
  if (o.includes('array') && s.includes('[]')) return 'OK';
  if (o.includes('monetary') && s.includes('monetary')) return 'OK';
  if (o.includes('date') && s.includes('string')) return 'OK';
  if (o.includes('numeric') && s.includes('string')) return 'OK';
  if (o.includes('taxid') && s.includes('taxid')) return 'OK';
  if (o.includes('address') && s.includes('address')) return 'OK';
  if (o.includes('email') && s.includes('email')) return 'OK';
  if (o.includes('name') && s.includes('name')) return 'OK';
  if (o.includes('vesting') && s.includes('vesting')) return 'OK';
  if (o.includes('securityexemption') && s.includes('securityexemption')) return 'OK';
  if (o.includes('sharenumberrange') && s.includes('sharenumberrange')) return 'OK';
  if (o.includes('objectreference') && s.includes('objectreference')) return 'OK';
  if (o.includes('integer') && s.includes('number')) return 'OK';
  if (o.includes('md5') && s.includes('string')) return 'OK'; // Md5 is 32-char hex string
  if (o.includes('countrycode') && s.includes('string')) return 'OK';
  if (o.includes('countrysubdivisioncode') && s.includes('string')) return 'OK';
  if (o.includes('stakeholderstatustype') && s.includes('stakeholderstatus')) return 'OK'; // Same enum
  if (o.includes('stockplancancellationbehaviortype') && s.includes('stockplancancellationbehavior')) return 'OK';
  if (o.includes('oneof') && (s.includes('string') || s.includes('initialsharesauthorized'))) return 'OK';
  if (o.includes('ratioconversionmechanism') && s.includes('numerator')) return 'OK';
  if (o.includes('capitalizationdefinition') && s.includes('capitalization')) return 'OK';
  return 'MISMATCH';
}

function walkSchemas(dir: string, acc: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSchemas(full, acc);
    else if (e.name.endsWith('.schema.json')) acc.push(full);
  }
}

function main(): void {
  const schemaFiles: string[] = [];
  walkSchemas(OCF_OBJECTS, schemaFiles);

  const report: string[] = [];
  report.push('# OCF Schema vs SDK TypeScript Interface Field-by-Field Audit');
  report.push('');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  report.push('## Executive Summary');
  report.push('');
  report.push(
    'This audit compares all 56 OCF object schemas against their corresponding SDK TypeScript interfaces in `src/types/native.ts`.'
  );
  report.push('');
  report.push('**Key findings:**');
  report.push(
    '- OCF schemas use `allOf` inheritance (Object base adds `id`, `object_type`, `comments`; Transaction adds `date`; SecurityTransaction adds `security_id`; Issuance adds `custom_id`, `stakeholder_id`, `security_law_exemptions`, etc.)'
  );
  report.push(
    '- Most discrepancies fall into: (1) **MISSING** - OCF field not in SDK, (2) **EXTRA** - SDK field not in OCF (potential `additionalProperties: false` violation), (3) **MISMATCH** - required/optional or type differences'
  );
  report.push(
    '- **Financing**: OCF uses `name` and `date`; SDK uses `round_name` and `financing_date`. OCF requires `issuance_ids`; SDK omits it. SDK adds `financing_type`, `amount_raised`, `pre_money_valuation`, `post_money_valuation`, `stock_class_id`.'
  );
  report.push(
    '- **PlanSecurity*** schemas inherit from EquityCompensation equivalents; base fields (id, date, security_id) come from Transaction/SecurityTransaction.'
  );
  report.push('');
  report.push('---');
  report.push('');
  report.push('## Per-Object Audit');
  report.push('');

  const allDiscrepancies: Array<{ schema: string; field: string; status: string; detail: string }> = [];
  let totalOk = 0;
  let totalMissing = 0;
  let totalExtra = 0;
  let totalMismatch = 0;

  for (const schemaPath of schemaFiles.sort()) {
    const basename = path.basename(schemaPath, '.schema.json');
    const sdkInterface = SCHEMA_TO_SDK[basename];
    if (!sdkInterface) {
      report.push(`### ${basename}`);
      report.push('*No SDK interface mapping defined*');
      report.push('');
      continue;
    }

    const { properties, required, additionalProperties } = collectSchemaProperties(schemaPath);
    const sdkFields = extractSdkFields(sdkInterface);

    report.push(`### ${basename} → ${sdkInterface}`);
    report.push('');
    report.push(`| Field | OCF Type | OCF Required? | SDK Type | SDK Required? | Status |`);
    report.push(`|-------|----------|----------------|----------|---------------|--------|`);

    const ocfFieldNames = new Set(Object.keys(properties));
    const sdkFieldNames = new Set(sdkFields.keys());

    for (const ocfField of [...ocfFieldNames].sort()) {
      if (ocfField === 'object_type') continue; // Output discriminator, not input
      const prop = properties[ocfField];
      const ocfType = getOcfType(prop);
      const ocfReq = required.has(ocfField);
      const sdkField = findSdkField(sdkFields, ocfField, sdkInterface);
      const sdkInfo = sdkField ? sdkFields.get(sdkField) : null;

      let status = 'OK';
      let sdkTypeStr = '-';
      let sdkReqStr = '-';

      if (!sdkInfo) {
        status = 'MISSING';
        totalMissing++;
        allDiscrepancies.push({
          schema: basename,
          field: ocfField,
          status: 'MISSING',
          detail: 'Field in OCF schema but not in SDK',
        });
      } else {
        sdkTypeStr = sdkInfo.type;
        sdkReqStr = sdkInfo.required ? 'Yes' : 'No';
        if (ocfReq && !sdkInfo.required) {
          status = 'MISMATCH';
          totalMismatch++;
          allDiscrepancies.push({
            schema: basename,
            field: ocfField,
            status: 'MISMATCH',
            detail: 'OCF required but SDK optional',
          });
        } else if (!ocfReq && sdkInfo.required) {
          status = 'MISMATCH';
          totalMismatch++;
          allDiscrepancies.push({
            schema: basename,
            field: ocfField,
            status: 'MISMATCH',
            detail: 'OCF optional but SDK required',
          });
        } else if (compareTypes(ocfType, sdkInfo.type) === 'MISMATCH') {
          status = 'MISMATCH';
          totalMismatch++;
          allDiscrepancies.push({
            schema: basename,
            field: ocfField,
            status: 'MISMATCH',
            detail: `Type: OCF ${ocfType} vs SDK ${sdkInfo.type}`,
          });
        } else {
          totalOk++;
        }
      }

      report.push(`| ${ocfField} | ${ocfType} | ${ocfReq ? 'Yes' : 'No'} | ${sdkTypeStr} | ${sdkReqStr} | ${status} |`);
    }

    for (const sdkField of sdkFieldNames) {
      const aliasesForInterface = FIELD_ALIASES[sdkInterface] ?? {};
      const reverseAliases = Object.fromEntries(Object.entries(aliasesForInterface).map(([k, v]) => [v, k]));
      const ocfEquivalent = reverseAliases[sdkField] ?? sdkField;
      if (!ocfFieldNames.has(ocfEquivalent) && !ocfFieldNames.has(sdkField)) {
        const sdkInfo = sdkFields.get(sdkField)!;
        const isExtra = !additionalProperties;
        report.push(
          `| ${sdkField} | - | - | ${sdkInfo.type} | ${sdkInfo.required ? 'Yes' : 'No'} | ${isExtra ? 'EXTRA' : 'OK'} |`
        );
        if (isExtra) {
          totalExtra++;
          allDiscrepancies.push({
            schema: basename,
            field: sdkField,
            status: 'EXTRA',
            detail: 'Field in SDK but not in OCF schema (additionalProperties: false)',
          });
        }
      }
    }

    report.push('');
  }

  report.push('## All Discrepancies Summary');
  report.push('');
  report.push('| Schema | Field | Status | Detail |');
  report.push('|--------|-------|--------|--------|');
  for (const d of allDiscrepancies) {
    report.push(`| ${d.schema} | ${d.field} | ${d.status} | ${d.detail} |`);
  }

  report.push('');
  report.push('## Counts');
  report.push('');
  report.push(`- **OK**: ${totalOk}`);
  report.push(`- **MISSING** (in SDK): ${totalMissing}`);
  report.push(`- **EXTRA** (in SDK, schema has additionalProperties: false): ${totalExtra}`);
  report.push(`- **MISMATCH**: ${totalMismatch}`);

  const outPath = path.join(REPO_ROOT, 'audit-field-report.md');
  fs.writeFileSync(outPath, report.join('\n'));
  console.log(`Wrote ${outPath}`);
}

main();
