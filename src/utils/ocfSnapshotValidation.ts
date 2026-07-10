import { getOcfObjectTypeCapability } from './ocfObjectTypeCapabilities';

/** The schema-valid identity fields required by graph validation. */
export type OcfCapTableSnapshotObject = Readonly<{
  id: string;
  object_type: string;
  [field: string]: unknown;
}>;

export type OcfCapTableSnapshotIssueCode =
  | 'AMBIGUOUS_SECURITY_REFERENCE'
  | 'DUPLICATE_OBJECT_ID'
  | 'DUPLICATE_SECURITY_ID'
  | 'ISSUER_CARDINALITY'
  | 'MISSING_REFERENCE'
  | 'MISSING_TRIGGER'
  | 'MISSING_VESTING_CONDITION'
  | 'SCHEMA_ONLY_REFERENCE'
  | 'STOCK_PLAN_CLASS_MISMATCH'
  | 'STOCK_PLAN_SECURITY_MISMATCH'
  | 'UNSUPPORTED_OBJECT_TYPE'
  | 'VESTING_TRIGGER_MISMATCH';

/** A deterministic, structured snapshot integrity diagnostic. */
export interface OcfCapTableSnapshotIssue {
  code: OcfCapTableSnapshotIssueCode;
  message: string;
  objectType?: string;
  objectId?: string;
  path?: string;
  referenceId?: string;
  targetObjectTypes?: readonly string[];
  actualReferenceId?: string;
  count?: number;
}

/** Pure validation result for a complete OCF cap-table snapshot. */
export interface OcfCapTableSnapshotValidationResult {
  valid: boolean;
  issues: readonly OcfCapTableSnapshotIssue[];
}

type SecurityFamily = 'convertible' | 'equity-compensation' | 'stock' | 'warrant';

interface IndexedObject {
  canonicalObjectType: string;
  data: OcfCapTableSnapshotObject;
}

interface ObjectReferenceRule {
  sourceObjectTypes: readonly string[];
  path: string;
  targetObjectTypes: readonly string[];
  many?: boolean;
  optional?: boolean;
}

interface SecurityReferenceRule {
  sourceObjectTypes: readonly string[];
  path: string;
  targetFamilies: readonly SecurityFamily[];
  many?: boolean;
}

const ISSUANCE_OBJECT_TYPE_BY_FAMILY = {
  convertible: 'TX_CONVERTIBLE_ISSUANCE',
  'equity-compensation': 'TX_EQUITY_COMPENSATION_ISSUANCE',
  stock: 'TX_STOCK_ISSUANCE',
  warrant: 'TX_WARRANT_ISSUANCE',
} as const satisfies Record<SecurityFamily, string>;

const ISSUANCE_OBJECT_TYPES = Object.values(ISSUANCE_OBJECT_TYPE_BY_FAMILY);

const OBJECT_REFERENCE_RULES: readonly ObjectReferenceRule[] = [
  {
    sourceObjectTypes: ['TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT'],
    path: 'issuer_id',
    targetObjectTypes: ['ISSUER'],
  },
  {
    sourceObjectTypes: ['CE_STAKEHOLDER_RELATIONSHIP', 'CE_STAKEHOLDER_STATUS'],
    path: 'stakeholder_id',
    targetObjectTypes: ['STAKEHOLDER'],
  },
  {
    sourceObjectTypes: ISSUANCE_OBJECT_TYPES,
    path: 'stakeholder_id',
    targetObjectTypes: ['STAKEHOLDER'],
  },
  {
    sourceObjectTypes: [
      'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      'TX_STOCK_CLASS_CONVERSION_RATIO_ADJUSTMENT',
      'TX_STOCK_CLASS_SPLIT',
      'TX_STOCK_ISSUANCE',
      'VALUATION',
    ],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
  },
  {
    sourceObjectTypes: ['TX_EQUITY_COMPENSATION_ISSUANCE'],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['STOCK_PLAN'],
    path: 'stock_class_id',
    targetObjectTypes: ['STOCK_CLASS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['STOCK_PLAN'],
    path: 'stock_class_ids',
    targetObjectTypes: ['STOCK_CLASS'],
    many: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_PLAN_POOL_ADJUSTMENT', 'TX_STOCK_PLAN_RETURN_TO_POOL'],
    path: 'stock_plan_id',
    targetObjectTypes: ['STOCK_PLAN'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
    path: 'stock_plan_id',
    targetObjectTypes: ['STOCK_PLAN'],
    optional: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_WARRANT_ISSUANCE'],
    path: 'vesting_terms_id',
    targetObjectTypes: ['VESTING_TERMS'],
    optional: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_ISSUANCE'],
    path: 'stock_legend_ids',
    targetObjectTypes: ['STOCK_LEGEND_TEMPLATE'],
    many: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_REISSUANCE'],
    path: 'split_transaction_id',
    targetObjectTypes: ['TX_STOCK_CLASS_SPLIT'],
    optional: true,
  },
];

const SECURITY_REFERENCE_RULES: readonly SecurityReferenceRule[] = [
  {
    sourceObjectTypes: [
      'TX_CONVERTIBLE_ACCEPTANCE',
      'TX_CONVERTIBLE_CANCELLATION',
      'TX_CONVERTIBLE_CONVERSION',
      'TX_CONVERTIBLE_RETRACTION',
      'TX_CONVERTIBLE_TRANSFER',
    ],
    path: 'security_id',
    targetFamilies: ['convertible'],
  },
  {
    sourceObjectTypes: [
      'TX_EQUITY_COMPENSATION_ACCEPTANCE',
      'TX_EQUITY_COMPENSATION_CANCELLATION',
      'TX_EQUITY_COMPENSATION_EXERCISE',
      'TX_EQUITY_COMPENSATION_RELEASE',
      'TX_EQUITY_COMPENSATION_REPRICING',
      'TX_EQUITY_COMPENSATION_RETRACTION',
      'TX_EQUITY_COMPENSATION_TRANSFER',
    ],
    path: 'security_id',
    targetFamilies: ['equity-compensation'],
  },
  {
    sourceObjectTypes: [
      'TX_STOCK_ACCEPTANCE',
      'TX_STOCK_CANCELLATION',
      'TX_STOCK_CONVERSION',
      'TX_STOCK_REISSUANCE',
      'TX_STOCK_REPURCHASE',
      'TX_STOCK_RETRACTION',
      'TX_STOCK_TRANSFER',
    ],
    path: 'security_id',
    targetFamilies: ['stock'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_CONSOLIDATION'],
    path: 'security_ids',
    targetFamilies: ['stock'],
    many: true,
  },
  {
    sourceObjectTypes: ['TX_STOCK_PLAN_RETURN_TO_POOL'],
    path: 'security_id',
    targetFamilies: ['stock', 'equity-compensation'],
  },
  {
    sourceObjectTypes: [
      'TX_WARRANT_ACCEPTANCE',
      'TX_WARRANT_CANCELLATION',
      'TX_WARRANT_EXERCISE',
      'TX_WARRANT_RETRACTION',
      'TX_WARRANT_TRANSFER',
    ],
    path: 'security_id',
    targetFamilies: ['warrant'],
  },
  {
    sourceObjectTypes: ['TX_VESTING_ACCELERATION', 'TX_VESTING_EVENT', 'TX_VESTING_START'],
    path: 'security_id',
    targetFamilies: ['stock', 'warrant', 'equity-compensation'],
  },
];

const CONVERSION_RIGHT_ROOTS: Readonly<Partial<Record<string, readonly string[]>>> = {
  STOCK_CLASS: ['conversion_rights'],
  TX_CONVERTIBLE_ISSUANCE: ['conversion_triggers'],
  TX_WARRANT_ISSUANCE: ['exercise_triggers'],
};

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function stringValues(value: unknown, many: boolean, optional: boolean): string[] {
  if (many) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && (!optional || item.length > 0))
      : [];
  }
  return typeof value === 'string' && (!optional || value.length > 0) ? [value] : [];
}

function canonicalObjectType(objectType: string): string {
  const capability = getOcfObjectTypeCapability(objectType);
  return capability.support === 'ledger-backed' ? capability.canonicalObjectType : objectType;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function indexObjects(objects: readonly OcfCapTableSnapshotObject[]): IndexedObject[] {
  return objects
    .map((data) => ({ data, canonicalObjectType: canonicalObjectType(data.object_type) }))
    .sort((left, right) => {
      const typeOrder = compareText(left.canonicalObjectType, right.canonicalObjectType);
      return typeOrder !== 0 ? typeOrder : compareText(left.data.id, right.data.id);
    });
}

function issueSortKey(issue: OcfCapTableSnapshotIssue): string {
  return [
    issue.code,
    issue.objectType ?? '',
    issue.objectId ?? '',
    issue.path ?? '',
    issue.referenceId ?? '',
    issue.targetObjectTypes?.join(',') ?? '',
    issue.actualReferenceId ?? '',
    String(issue.count ?? ''),
  ].join('\u0000');
}

function objectKey(objectType: string, objectId: string): string {
  return `${objectType}\u0000${objectId}`;
}

function targetLabel(targetObjectTypes: readonly string[]): string {
  return targetObjectTypes.join(' or ');
}

function missingReferenceIssue(
  source: IndexedObject,
  path: string,
  referenceId: string,
  targetObjectTypes: readonly string[]
): OcfCapTableSnapshotIssue {
  return {
    code: 'MISSING_REFERENCE',
    message: `${source.canonicalObjectType} ${source.data.id} ${path} references missing ${targetLabel(targetObjectTypes)} ${referenceId}`,
    objectType: source.canonicalObjectType,
    objectId: source.data.id,
    path,
    referenceId,
    targetObjectTypes,
  };
}

function collectNestedStringField(
  value: unknown,
  field: string,
  path: string,
  result: Array<{ path: string; value: string }>
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNestedStringField(item, field, `${path}[${index}]`, result));
    return;
  }

  const record = asRecord(value);
  if (record === null) return;
  for (const key of Object.keys(record).sort()) {
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (key === field && typeof record[key] === 'string') {
      result.push({ path: nextPath, value: record[key] });
    } else {
      collectNestedStringField(record[key], field, nextPath, result);
    }
  }
}

function stockPlanClassIds(plan: OcfCapTableSnapshotObject): Set<string> {
  const ids = new Set<string>();
  if (typeof plan.stock_class_id === 'string') ids.add(plan.stock_class_id);
  if (Array.isArray(plan.stock_class_ids)) {
    for (const value of plan.stock_class_ids) {
      if (typeof value === 'string') ids.add(value);
    }
  }
  return ids;
}

function triggerIds(issuance: OcfCapTableSnapshotObject, field: string): Set<string> {
  const triggers = issuance[field];
  if (!Array.isArray(triggers)) return new Set();
  return new Set(
    triggers
      .map((trigger) => asRecord(trigger)?.trigger_id)
      .filter((triggerId): triggerId is string => typeof triggerId === 'string')
  );
}

/**
 * Validate final-state graph integrity for a complete, schema-valid OCF snapshot.
 *
 * The function is deliberately order-independent and side-effect free. It does
 * not validate transaction chronology, balances, or business quantities.
 */
export function validateOcfCapTableSnapshot(
  objects: readonly OcfCapTableSnapshotObject[]
): OcfCapTableSnapshotValidationResult {
  const indexed = indexObjects(objects);
  const issues: OcfCapTableSnapshotIssue[] = [];
  const objectsByKey = new Map<string, IndexedObject[]>();
  const securityByFamily = new Map<SecurityFamily, Map<string, IndexedObject[]>>();
  const allSecurityIds = new Map<string, IndexedObject[]>();

  for (const family of Object.keys(ISSUANCE_OBJECT_TYPE_BY_FAMILY) as SecurityFamily[]) {
    securityByFamily.set(family, new Map());
  }

  for (const item of indexed) {
    const key = objectKey(item.canonicalObjectType, item.data.id);
    const sameObjects = objectsByKey.get(key) ?? [];
    sameObjects.push(item);
    objectsByKey.set(key, sameObjects);

    const capability = getOcfObjectTypeCapability(item.data.object_type);
    if (capability.support === 'unsupported') {
      issues.push({
        code: 'UNSUPPORTED_OBJECT_TYPE',
        message: `Unsupported OCF object type ${item.data.object_type}`,
        objectType: item.data.object_type,
        objectId: item.data.id,
      });
    }

    const family = (Object.entries(ISSUANCE_OBJECT_TYPE_BY_FAMILY) as Array<[SecurityFamily, string]>).find(
      ([, objectType]) => objectType === item.canonicalObjectType
    )?.[0];
    if (family !== undefined && typeof item.data.security_id === 'string') {
      const familyIndex = securityByFamily.get(family);
      if (familyIndex === undefined) continue;
      const familyMatches = familyIndex.get(item.data.security_id) ?? [];
      familyMatches.push(item);
      familyIndex.set(item.data.security_id, familyMatches);

      const allMatches = allSecurityIds.get(item.data.security_id) ?? [];
      allMatches.push(item);
      allSecurityIds.set(item.data.security_id, allMatches);
    }
  }

  const issuerCount = indexed.filter((item) => item.canonicalObjectType === 'ISSUER').length;
  if (issuerCount !== 1) {
    issues.push({
      code: 'ISSUER_CARDINALITY',
      message: `Expected exactly one ISSUER, found ${issuerCount}`,
      objectType: 'ISSUER',
      count: issuerCount,
    });
  }

  for (const matches of objectsByKey.values()) {
    if (matches.length > 1) {
      const [first] = matches;
      issues.push({
        code: 'DUPLICATE_OBJECT_ID',
        message: `Duplicate ${first.canonicalObjectType} id ${first.data.id}`,
        objectType: first.canonicalObjectType,
        objectId: first.data.id,
        count: matches.length,
      });
    }
  }

  for (const [securityId, matches] of allSecurityIds) {
    if (matches.length > 1) {
      issues.push({
        code: 'DUPLICATE_SECURITY_ID',
        message: `Duplicate security_id ${securityId}`,
        path: 'security_id',
        referenceId: securityId,
        targetObjectTypes: matches.map((match) => match.canonicalObjectType).sort(compareText),
        count: matches.length,
      });
    }
  }

  const hasObject = (objectTypes: readonly string[], id: string): boolean =>
    objectTypes.some((objectType) => objectsByKey.has(objectKey(objectType, id)));

  for (const rule of OBJECT_REFERENCE_RULES) {
    for (const source of indexed.filter((item) => rule.sourceObjectTypes.includes(item.canonicalObjectType))) {
      for (const referenceId of stringValues(source.data[rule.path], rule.many === true, rule.optional === true)) {
        if (!hasObject(rule.targetObjectTypes, referenceId)) {
          issues.push(missingReferenceIssue(source, rule.path, referenceId, rule.targetObjectTypes));
        }
      }
    }
  }

  for (const rule of SECURITY_REFERENCE_RULES) {
    const targetObjectTypes = rule.targetFamilies.map((family) => ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]);
    for (const source of indexed.filter((item) => rule.sourceObjectTypes.includes(item.canonicalObjectType))) {
      for (const referenceId of stringValues(source.data[rule.path], rule.many === true, false)) {
        const matchCount = rule.targetFamilies.reduce(
          (count, family) => count + (securityByFamily.get(family)?.get(referenceId)?.length ?? 0),
          0
        );
        if (matchCount === 0) {
          issues.push(missingReferenceIssue(source, rule.path, referenceId, targetObjectTypes));
        } else if (matchCount > 1) {
          issues.push({
            code: 'AMBIGUOUS_SECURITY_REFERENCE',
            message: `${source.canonicalObjectType} ${source.data.id} ${rule.path} ambiguously references security ${referenceId}`,
            objectType: source.canonicalObjectType,
            objectId: source.data.id,
            path: rule.path,
            referenceId,
            targetObjectTypes,
            count: matchCount,
          });
        }
      }
    }
  }

  for (const source of indexed) {
    const roots = CONVERSION_RIGHT_ROOTS[source.canonicalObjectType];
    if (roots === undefined) continue;
    for (const root of roots) {
      const references: Array<{ path: string; value: string }> = [];
      collectNestedStringField(source.data[root], 'converts_to_stock_class_id', root, references);
      for (const reference of references) {
        // Optional conversion targets use the OCF empty-string representation.
        // Required target presence remains the raw-schema validator's concern.
        if (reference.value.length > 0 && !hasObject(['STOCK_CLASS'], reference.value)) {
          issues.push(missingReferenceIssue(source, reference.path, reference.value, ['STOCK_CLASS']));
        }
      }
    }
  }

  for (const source of indexed.filter((item) =>
    ['TX_EQUITY_COMPENSATION_ISSUANCE', 'TX_STOCK_ISSUANCE'].includes(item.canonicalObjectType)
  )) {
    const planId = source.data.stock_plan_id;
    const classId = source.data.stock_class_id;
    if (typeof planId !== 'string' || planId.length === 0 || typeof classId !== 'string' || classId.length === 0) {
      continue;
    }
    const planMatches = objectsByKey.get(objectKey('STOCK_PLAN', planId)) ?? [];
    if (planMatches.length === 1 && !stockPlanClassIds(planMatches[0].data).has(classId)) {
      issues.push({
        code: 'STOCK_PLAN_CLASS_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} stock plan ${planId} does not include stock class ${classId}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'stock_plan_id',
        referenceId: planId,
        targetObjectTypes: ['STOCK_PLAN', 'STOCK_CLASS'],
      });
    }
  }

  for (const source of indexed.filter((item) => item.canonicalObjectType === 'TX_STOCK_PLAN_RETURN_TO_POOL')) {
    const securityId = source.data.security_id;
    const returnPlanId = source.data.stock_plan_id;
    if (
      typeof securityId !== 'string' ||
      securityId.length === 0 ||
      typeof returnPlanId !== 'string' ||
      returnPlanId.length === 0
    ) {
      continue;
    }
    const matches = (['stock', 'equity-compensation'] as const).flatMap(
      (family) => securityByFamily.get(family)?.get(securityId) ?? []
    );
    if (matches.length !== 1) continue;
    const issuancePlanId = matches[0].data.stock_plan_id;
    if (issuancePlanId !== returnPlanId) {
      issues.push({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        message:
          typeof issuancePlanId === 'string' && issuancePlanId.length > 0
            ? `${source.canonicalObjectType} ${source.data.id} returns security ${securityId} to stock plan ${returnPlanId}, but the issuance belongs to ${issuancePlanId}`
            : `${source.canonicalObjectType} ${source.data.id} returns non-plan security ${securityId} to stock plan ${returnPlanId}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.stock_plan_id',
        referenceId: returnPlanId,
        targetObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
        ...(typeof issuancePlanId === 'string' ? { actualReferenceId: issuancePlanId } : {}),
      });
    }
  }

  const validateTransactionTrigger = (transactionType: string, family: SecurityFamily, issuanceField: string): void => {
    for (const source of indexed.filter((item) => item.canonicalObjectType === transactionType)) {
      if (typeof source.data.security_id !== 'string' || typeof source.data.trigger_id !== 'string') continue;
      const matches = securityByFamily.get(family)?.get(source.data.security_id) ?? [];
      if (matches.length !== 1) continue;
      if (!triggerIds(matches[0].data, issuanceField).has(source.data.trigger_id)) {
        issues.push({
          code: 'MISSING_TRIGGER',
          message: `${source.canonicalObjectType} ${source.data.id} references missing trigger ${source.data.trigger_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: 'trigger_id',
          referenceId: source.data.trigger_id,
          targetObjectTypes: [ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]],
        });
      }
    }
  };
  validateTransactionTrigger('TX_CONVERTIBLE_CONVERSION', 'convertible', 'conversion_triggers');
  validateTransactionTrigger('TX_WARRANT_EXERCISE', 'warrant', 'exercise_triggers');

  for (const source of indexed.filter((item) =>
    ['TX_VESTING_EVENT', 'TX_VESTING_START'].includes(item.canonicalObjectType)
  )) {
    if (typeof source.data.security_id !== 'string' || typeof source.data.vesting_condition_id !== 'string') continue;
    const matches = (['stock', 'warrant', 'equity-compensation'] as const).flatMap(
      (family) => securityByFamily.get(family)?.get(source.data.security_id as string) ?? []
    );
    if (matches.length !== 1) continue;
    const vestingTermsId = matches[0].data.vesting_terms_id;
    if (typeof vestingTermsId !== 'string' || vestingTermsId.length === 0) {
      issues.push({
        code: 'MISSING_REFERENCE',
        message: `${source.canonicalObjectType} ${source.data.id} security ${source.data.security_id} has no vesting terms`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.vesting_terms_id',
        targetObjectTypes: ['VESTING_TERMS'],
      });
      continue;
    }
    const vestingTermsMatches = objectsByKey.get(objectKey('VESTING_TERMS', vestingTermsId)) ?? [];
    if (vestingTermsMatches.length !== 1) continue;
    const conditions = vestingTermsMatches[0].data.vesting_conditions;
    const condition = Array.isArray(conditions)
      ? conditions.map(asRecord).find((candidate) => candidate?.id === source.data.vesting_condition_id)
      : undefined;
    if (condition === undefined || condition === null) {
      issues.push({
        code: 'MISSING_VESTING_CONDITION',
        message: `${source.canonicalObjectType} ${source.data.id} references missing vesting condition ${source.data.vesting_condition_id}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'vesting_condition_id',
        referenceId: source.data.vesting_condition_id,
        targetObjectTypes: ['VESTING_TERMS'],
      });
      continue;
    }
    const expectedTriggerType =
      source.canonicalObjectType === 'TX_VESTING_START' ? 'VESTING_START_DATE' : 'VESTING_EVENT';
    const triggerType = asRecord(condition.trigger)?.type;
    if (triggerType !== expectedTriggerType) {
      issues.push({
        code: 'VESTING_TRIGGER_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} references vesting condition ${source.data.vesting_condition_id} with trigger ${String(triggerType)}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'vesting_condition_id',
        referenceId: source.data.vesting_condition_id,
        targetObjectTypes: ['VESTING_TERMS'],
      });
    }
  }

  for (const source of indexed.filter((item) => item.canonicalObjectType === 'DOCUMENT')) {
    if (!Array.isArray(source.data.related_objects)) continue;
    source.data.related_objects.forEach((reference, index) => {
      const record = asRecord(reference);
      if (typeof record?.object_type !== 'string' || typeof record.object_id !== 'string') return;
      const capability = getOcfObjectTypeCapability(record.object_type);
      if (capability.support === 'schema-only') {
        issues.push({
          code: 'SCHEMA_ONLY_REFERENCE',
          message: `${source.canonicalObjectType} ${source.data.id} cannot reference schema-only ${record.object_type} ${record.object_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: `related_objects[${index}].object_type`,
          referenceId: record.object_id,
          targetObjectTypes: [record.object_type],
        });
        return;
      }
      const targetType = canonicalObjectType(record.object_type);
      if (!hasObject([targetType], record.object_id)) {
        issues.push(
          missingReferenceIssue(source, `related_objects[${index}].object_id`, record.object_id, [targetType])
        );
      }
    });
  }

  issues.sort((left, right) => compareText(issueSortKey(left), issueSortKey(right)));
  return { valid: issues.length === 0, issues };
}
