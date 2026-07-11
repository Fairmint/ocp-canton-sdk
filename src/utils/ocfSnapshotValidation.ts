import { getOcfObjectTypeCapability } from './ocfObjectTypeCapabilities';

/** The schema-valid identity fields required by graph validation. */
export type OcfCapTableSnapshotObject<ObjectType extends string = string> = Readonly<{
  id: string;
  object_type: ObjectType;
  [field: string]: unknown;
}>;

export type OcfCapTableSnapshotIssueCode =
  | 'AMBIGUOUS_SECURITY_REFERENCE'
  | 'AMBIGUOUS_TRIGGER'
  | 'DUPLICATE_OBJECT_ID'
  | 'DUPLICATE_SECURITY_PRODUCER'
  | 'DUPLICATE_TRIGGER_ID'
  | 'DUPLICATE_VESTING_CONDITION_ID'
  | 'ISSUER_CARDINALITY'
  | 'MALFORMED_SECURITY_FIELD'
  | 'MISSING_REFERENCE'
  | 'MISSING_TRIGGER'
  | 'MISSING_VESTING_CONDITION'
  | 'MULTIPLE_SECURITY_CONSUMERS'
  | 'SCHEMA_ONLY_REFERENCE'
  | 'SECURITY_FAMILY_MISMATCH'
  | 'SECURITY_LINEAGE_CYCLE'
  | 'SELF_VESTING_CONDITION_REFERENCE'
  | 'STOCK_PLAN_CLASS_MISMATCH'
  | 'STOCK_PLAN_SECURITY_MISMATCH'
  | 'UNSUPPORTED_OBJECT_TYPE'
  | 'VESTING_CONDITION_CYCLE'
  | 'VESTING_TRIGGER_MISMATCH';

/** Canonical security families tracked by snapshot lineage validation. */
export type OcfSecurityFamily = 'convertible' | 'equity-compensation' | 'stock' | 'warrant';

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
  expectedSecurityFamilies?: readonly OcfSecurityFamily[];
  actualSecurityFamily?: OcfSecurityFamily;
  cycleIds?: readonly string[];
  count?: number;
}

/** Pure validation result for a complete OCF cap-table snapshot. */
export interface OcfCapTableSnapshotValidationResult {
  valid: boolean;
  issues: readonly OcfCapTableSnapshotIssue[];
}

type SecurityFamily = OcfSecurityFamily;

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

interface ObservedSecurityReferenceRule {
  sourceObjectTypes: readonly string[];
  path: 'security_id';
  targetFamilies: readonly SecurityFamily[];
}

type SecurityInputField = 'security_id' | 'security_ids';
type SecurityOutputField = 'balance_security_id' | 'resulting_security_id' | 'resulting_security_ids';

interface SecurityInputRule {
  path: SecurityInputField;
  cardinality: 'one' | 'many';
  families: readonly SecurityFamily[];
}

interface SecurityOutputRule {
  path: SecurityOutputField;
  cardinality: 'one' | 'many';
  family: SecurityFamily;
  optional?: boolean;
}

interface SecurityTransitionRule {
  input: SecurityInputRule;
  outputs: readonly SecurityOutputRule[];
}

interface SecurityFieldValue {
  id: string;
  path: string;
}

interface SecurityTransitionInstance {
  source: IndexedObject;
  rule: SecurityTransitionRule;
  inputs: readonly SecurityFieldValue[];
  outputs: ReadonlyArray<SecurityFieldValue & { family: SecurityFamily }>;
}

interface SecurityProducer {
  id: string;
  family: SecurityFamily;
  source: IndexedObject;
  path: string;
  kind: 'issuance' | 'transition';
  inputIds: readonly string[];
}

interface DirectedGraphEdge {
  from: string;
  to: string;
  source: IndexedObject;
  path: string;
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

/** Security references that observe a security without terminating its lineage. */
const OBSERVED_SECURITY_REFERENCE_RULES: readonly ObservedSecurityReferenceRule[] = [
  {
    sourceObjectTypes: ['TX_CONVERTIBLE_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['convertible'],
  },
  {
    sourceObjectTypes: ['TX_EQUITY_COMPENSATION_ACCEPTANCE', 'TX_EQUITY_COMPENSATION_REPRICING'],
    path: 'security_id',
    targetFamilies: ['equity-compensation'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['stock'],
  },
  {
    sourceObjectTypes: ['TX_STOCK_PLAN_RETURN_TO_POOL'],
    path: 'security_id',
    targetFamilies: ['stock', 'equity-compensation'],
  },
  {
    sourceObjectTypes: ['TX_WARRANT_ACCEPTANCE'],
    path: 'security_id',
    targetFamilies: ['warrant'],
  },
  {
    sourceObjectTypes: ['TX_VESTING_ACCELERATION', 'TX_VESTING_EVENT', 'TX_VESTING_START'],
    path: 'security_id',
    targetFamilies: ['stock', 'warrant', 'equity-compensation'],
  },
];

type SecurityTransitionObjectType =
  | 'TX_CONVERTIBLE_CANCELLATION'
  | 'TX_CONVERTIBLE_CONVERSION'
  | 'TX_CONVERTIBLE_RETRACTION'
  | 'TX_CONVERTIBLE_TRANSFER'
  | 'TX_EQUITY_COMPENSATION_CANCELLATION'
  | 'TX_EQUITY_COMPENSATION_EXERCISE'
  | 'TX_EQUITY_COMPENSATION_RELEASE'
  | 'TX_EQUITY_COMPENSATION_RETRACTION'
  | 'TX_EQUITY_COMPENSATION_TRANSFER'
  | 'TX_STOCK_CANCELLATION'
  | 'TX_STOCK_CONSOLIDATION'
  | 'TX_STOCK_CONVERSION'
  | 'TX_STOCK_REISSUANCE'
  | 'TX_STOCK_REPURCHASE'
  | 'TX_STOCK_RETRACTION'
  | 'TX_STOCK_TRANSFER'
  | 'TX_WARRANT_CANCELLATION'
  | 'TX_WARRANT_EXERCISE'
  | 'TX_WARRANT_RETRACTION'
  | 'TX_WARRANT_TRANSFER';

const oneInput = (family: SecurityFamily): SecurityInputRule => ({
  path: 'security_id',
  cardinality: 'one',
  families: [family],
});

const manyStockInputs: SecurityInputRule = {
  path: 'security_ids',
  cardinality: 'many',
  families: ['stock'],
};

const optionalBalance = (family: SecurityFamily): SecurityOutputRule => ({
  path: 'balance_security_id',
  cardinality: 'one',
  family,
  optional: true,
});

const resultingMany = (family: SecurityFamily): SecurityOutputRule => ({
  path: 'resulting_security_ids',
  cardinality: 'many',
  family,
});

/**
 * Complete terminal-security transition matrix.
 *
 * Inputs consume existing lineage nodes. Output fields produce new nodes; they
 * deliberately do not resolve against issuance objects in the same snapshot.
 */
const SECURITY_TRANSITION_RULES = {
  TX_CONVERTIBLE_CANCELLATION: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible')],
  },
  TX_CONVERTIBLE_CONVERSION: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible'), resultingMany('stock')],
  },
  TX_CONVERTIBLE_RETRACTION: { input: oneInput('convertible'), outputs: [] },
  TX_CONVERTIBLE_TRANSFER: {
    input: oneInput('convertible'),
    outputs: [optionalBalance('convertible'), resultingMany('convertible')],
  },
  TX_EQUITY_COMPENSATION_CANCELLATION: {
    input: oneInput('equity-compensation'),
    outputs: [optionalBalance('equity-compensation')],
  },
  TX_EQUITY_COMPENSATION_EXERCISE: {
    input: oneInput('equity-compensation'),
    outputs: [resultingMany('stock')],
  },
  TX_EQUITY_COMPENSATION_RELEASE: {
    input: oneInput('equity-compensation'),
    outputs: [resultingMany('stock')],
  },
  TX_EQUITY_COMPENSATION_RETRACTION: { input: oneInput('equity-compensation'), outputs: [] },
  TX_EQUITY_COMPENSATION_TRANSFER: {
    input: oneInput('equity-compensation'),
    outputs: [optionalBalance('equity-compensation'), resultingMany('equity-compensation')],
  },
  TX_STOCK_CANCELLATION: { input: oneInput('stock'), outputs: [optionalBalance('stock')] },
  TX_STOCK_CONSOLIDATION: {
    input: manyStockInputs,
    outputs: [{ path: 'resulting_security_id', cardinality: 'one', family: 'stock' }],
  },
  TX_STOCK_CONVERSION: {
    input: oneInput('stock'),
    outputs: [optionalBalance('stock'), resultingMany('stock')],
  },
  TX_STOCK_REISSUANCE: { input: oneInput('stock'), outputs: [resultingMany('stock')] },
  TX_STOCK_REPURCHASE: { input: oneInput('stock'), outputs: [optionalBalance('stock')] },
  TX_STOCK_RETRACTION: { input: oneInput('stock'), outputs: [] },
  TX_STOCK_TRANSFER: {
    input: oneInput('stock'),
    outputs: [optionalBalance('stock'), resultingMany('stock')],
  },
  TX_WARRANT_CANCELLATION: { input: oneInput('warrant'), outputs: [optionalBalance('warrant')] },
  TX_WARRANT_EXERCISE: { input: oneInput('warrant'), outputs: [resultingMany('stock')] },
  TX_WARRANT_RETRACTION: { input: oneInput('warrant'), outputs: [] },
  TX_WARRANT_TRANSFER: {
    input: oneInput('warrant'),
    outputs: [optionalBalance('warrant'), resultingMany('warrant')],
  },
} as const satisfies Readonly<Record<SecurityTransitionObjectType, SecurityTransitionRule>>;

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

function requireFirst<T>(values: readonly T[], context: string): T {
  const first = values[0];
  if (first === undefined) throw new Error(`Internal snapshot validator invariant failed: ${context}`);
  return first;
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
    issue.expectedSecurityFamilies?.join(',') ?? '',
    issue.actualSecurityFamily ?? '',
    issue.cycleIds?.join(',') ?? '',
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

function issuanceFamily(objectType: string): SecurityFamily | undefined {
  switch (objectType) {
    case 'TX_CONVERTIBLE_ISSUANCE':
      return 'convertible';
    case 'TX_EQUITY_COMPENSATION_ISSUANCE':
      return 'equity-compensation';
    case 'TX_STOCK_ISSUANCE':
      return 'stock';
    case 'TX_WARRANT_ISSUANCE':
      return 'warrant';
    default:
      return undefined;
  }
}

function securityTransitionRule(objectType: string): SecurityTransitionRule | undefined {
  if (!Object.prototype.hasOwnProperty.call(SECURITY_TRANSITION_RULES, objectType)) return undefined;
  return SECURITY_TRANSITION_RULES[objectType as SecurityTransitionObjectType];
}

function securityTargetObjectTypes(families: readonly SecurityFamily[]): string[] {
  return families.map((family) => ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]);
}

function malformedSecurityFieldIssue(source: IndexedObject, path: string, message: string): OcfCapTableSnapshotIssue {
  return {
    code: 'MALFORMED_SECURITY_FIELD',
    message: `${source.canonicalObjectType} ${source.data.id} ${path} ${message}`,
    objectType: source.canonicalObjectType,
    objectId: source.data.id,
    path,
  };
}

function readSecurityField(
  source: IndexedObject,
  path: SecurityInputField | SecurityOutputField,
  cardinality: 'one' | 'many',
  optional: boolean,
  issues: OcfCapTableSnapshotIssue[]
): SecurityFieldValue[] {
  const value = source.data[path];
  if (value === undefined && optional) return [];

  if (cardinality === 'one') {
    if (typeof value !== 'string' || value.length === 0) {
      issues.push(
        malformedSecurityFieldIssue(
          source,
          path,
          optional ? 'must be a non-empty string when present' : 'must be a non-empty string'
        )
      );
      return [];
    }
    return [{ id: value, path }];
  }

  if (!Array.isArray(value) || value.length === 0) {
    issues.push(malformedSecurityFieldIssue(source, path, 'must be a non-empty array of non-empty strings'));
    return [];
  }

  const values: SecurityFieldValue[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof item !== 'string' || item.length === 0) {
      issues.push(malformedSecurityFieldIssue(source, itemPath, 'must be a non-empty string'));
      return;
    }
    values.push({ id: item, path: itemPath });
  });
  return values;
}

function directedCycles(nodes: Iterable<string>, edges: readonly DirectedGraphEdge[]): string[][] {
  const adjacency = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node, new Set());
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) ?? new Set<string>();
    neighbors.add(edge.to);
    adjacency.set(edge.from, neighbors);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    const reverseNeighbors = reverseAdjacency.get(edge.to) ?? new Set<string>();
    reverseNeighbors.add(edge.from);
    reverseAdjacency.set(edge.to, reverseNeighbors);
    if (!reverseAdjacency.has(edge.from)) reverseAdjacency.set(edge.from, new Set());
  }
  for (const node of adjacency.keys()) {
    if (!reverseAdjacency.has(node)) reverseAdjacency.set(node, new Set());
  }

  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const start of [...adjacency.keys()].sort(compareText)) {
    if (visited.has(start)) continue;
    const stack: Array<{ node: string; expanded: boolean }> = [{ node: start, expanded: false }];
    while (stack.length > 0) {
      const frame = stack.pop();
      if (frame === undefined) break;
      if (frame.expanded) {
        finishOrder.push(frame.node);
        continue;
      }
      if (visited.has(frame.node)) continue;
      visited.add(frame.node);
      stack.push({ node: frame.node, expanded: true });
      const neighbors = [...(adjacency.get(frame.node) ?? [])].sort(compareText).reverse();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) stack.push({ node: neighbor, expanded: false });
      }
    }
  }

  const assigned = new Set<string>();
  const components: string[][] = [];
  for (const start of [...finishOrder].reverse()) {
    if (assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) break;
      component.push(node);
      const neighbors = [...(reverseAdjacency.get(node) ?? [])].sort(compareText).reverse();
      for (const neighbor of neighbors) {
        if (assigned.has(neighbor)) continue;
        assigned.add(neighbor);
        stack.push(neighbor);
      }
    }
    component.sort(compareText);
    const hasSelfEdge = component.length === 1 && (adjacency.get(component[0] ?? '')?.has(component[0] ?? '') ?? false);
    if (component.length > 1 || hasSelfEdge) components.push(component);
  }
  return components.sort((left, right) => compareText(left.join('\u0000'), right.join('\u0000')));
}

function edgeSortKey(edge: DirectedGraphEdge): string {
  return [edge.source.canonicalObjectType, edge.source.data.id, edge.path, edge.from, edge.to].join('\u0000');
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

function triggerIdCounts(issuance: OcfCapTableSnapshotObject, field: string): Map<string, number> {
  const triggers = issuance[field];
  const counts = new Map<string, number>();
  if (!Array.isArray(triggers)) return counts;
  for (const trigger of triggers) {
    const triggerId = asRecord(trigger)?.trigger_id;
    if (typeof triggerId !== 'string' || triggerId.length === 0) continue;
    counts.set(triggerId, (counts.get(triggerId) ?? 0) + 1);
  }
  return counts;
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
  const securityProducers = new Map<string, SecurityProducer[]>();
  const terminalConsumers = new Map<string, Array<{ source: IndexedObject; path: string }>>();
  const transitionInstances: SecurityTransitionInstance[] = [];
  const lineageEdges: DirectedGraphEdge[] = [];

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

    const family = issuanceFamily(item.canonicalObjectType);
    if (family !== undefined) {
      const securityId = item.data.security_id;
      if (typeof securityId !== 'string' || securityId.length === 0) {
        issues.push(malformedSecurityFieldIssue(item, 'security_id', 'must be a non-empty string'));
      } else {
        const producers = securityProducers.get(securityId) ?? [];
        producers.push({
          id: securityId,
          family,
          source: item,
          path: 'security_id',
          kind: 'issuance',
          inputIds: [],
        });
        securityProducers.set(securityId, producers);
      }
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
      const first = requireFirst(matches, 'duplicate object list must be non-empty');
      issues.push({
        code: 'DUPLICATE_OBJECT_ID',
        message: `Duplicate ${first.canonicalObjectType} id ${first.data.id}`,
        objectType: first.canonicalObjectType,
        objectId: first.data.id,
        count: matches.length,
      });
    }
  }

  for (const source of indexed) {
    const rule = securityTransitionRule(source.canonicalObjectType);
    if (rule === undefined) continue;
    const inputs = readSecurityField(source, rule.input.path, rule.input.cardinality, false, issues);
    const outputs = rule.outputs.flatMap((outputRule) =>
      readSecurityField(source, outputRule.path, outputRule.cardinality, outputRule.optional === true, issues).map(
        (output) => ({ ...output, family: outputRule.family })
      )
    );
    const instance: SecurityTransitionInstance = { source, rule, inputs, outputs };
    transitionInstances.push(instance);

    for (const input of inputs) {
      const consumers = terminalConsumers.get(input.id) ?? [];
      consumers.push({ source, path: input.path });
      terminalConsumers.set(input.id, consumers);
      for (const output of outputs) {
        lineageEdges.push({ from: input.id, to: output.id, source, path: output.path });
      }
    }

    const inputIds = inputs.map((input) => input.id);
    for (const output of outputs) {
      const producers = securityProducers.get(output.id) ?? [];
      producers.push({
        id: output.id,
        family: output.family,
        source,
        path: output.path,
        kind: 'transition',
        inputIds,
      });
      securityProducers.set(output.id, producers);
    }
  }

  for (const [securityId, producers] of securityProducers) {
    if (producers.length > 1) {
      const sortedProducers = [...producers].sort((left, right) =>
        compareText(
          [left.source.canonicalObjectType, left.source.data.id, left.path].join('\u0000'),
          [right.source.canonicalObjectType, right.source.data.id, right.path].join('\u0000')
        )
      );
      const first = requireFirst(sortedProducers, 'duplicate producer list must be non-empty');
      issues.push({
        code: 'DUPLICATE_SECURITY_PRODUCER',
        message: `Security ${securityId} has ${producers.length} producers`,
        objectType: first.source.canonicalObjectType,
        objectId: first.source.data.id,
        path: first.path,
        referenceId: securityId,
        targetObjectTypes: [...new Set(producers.map((producer) => producer.source.canonicalObjectType))].sort(
          compareText
        ),
        count: producers.length,
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

  const validateSecurityReference = (
    source: IndexedObject,
    reference: SecurityFieldValue,
    targetFamilies: readonly SecurityFamily[]
  ): SecurityProducer | undefined => {
    const targetObjectTypes = securityTargetObjectTypes(targetFamilies);
    const producers = securityProducers.get(reference.id) ?? [];
    if (producers.length === 0) {
      issues.push(missingReferenceIssue(source, reference.path, reference.id, targetObjectTypes));
      return undefined;
    }
    if (producers.length > 1) {
      issues.push({
        code: 'AMBIGUOUS_SECURITY_REFERENCE',
        message: `${source.canonicalObjectType} ${source.data.id} ${reference.path} ambiguously references security ${reference.id}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: reference.path,
        referenceId: reference.id,
        targetObjectTypes,
        count: producers.length,
      });
      return undefined;
    }
    const producer = requireFirst(producers, 'resolved security producer must be present');
    if (!targetFamilies.includes(producer.family)) {
      issues.push({
        code: 'SECURITY_FAMILY_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} ${reference.path} expects ${targetFamilies.join(' or ')}, but security ${reference.id} is ${producer.family}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: reference.path,
        referenceId: reference.id,
        targetObjectTypes,
        expectedSecurityFamilies: targetFamilies,
        actualSecurityFamily: producer.family,
      });
      return undefined;
    }
    return producer;
  };

  for (const transition of transitionInstances) {
    for (const input of transition.inputs) {
      validateSecurityReference(transition.source, input, transition.rule.input.families);
    }
  }

  for (const rule of OBSERVED_SECURITY_REFERENCE_RULES) {
    for (const source of indexed.filter((item) => rule.sourceObjectTypes.includes(item.canonicalObjectType))) {
      const references = readSecurityField(source, rule.path, 'one', false, issues);
      for (const reference of references) validateSecurityReference(source, reference, rule.targetFamilies);
    }
  }

  for (const [securityId, consumers] of terminalConsumers) {
    if (consumers.length <= 1) continue;
    const sortedConsumers = [...consumers].sort((left, right) =>
      compareText(
        [left.source.canonicalObjectType, left.source.data.id, left.path].join('\u0000'),
        [right.source.canonicalObjectType, right.source.data.id, right.path].join('\u0000')
      )
    );
    const first = requireFirst(sortedConsumers, 'multiple consumer list must be non-empty');
    issues.push({
      code: 'MULTIPLE_SECURITY_CONSUMERS',
      message: `Security ${securityId} is consumed by ${consumers.length} terminal transactions`,
      objectType: first.source.canonicalObjectType,
      objectId: first.source.data.id,
      path: first.path,
      referenceId: securityId,
      targetObjectTypes: [...new Set(consumers.map((consumer) => consumer.source.canonicalObjectType))].sort(
        compareText
      ),
      count: consumers.length,
    });
  }

  for (const cycleIds of directedCycles(securityProducers.keys(), lineageEdges)) {
    const cycleSet = new Set(cycleIds);
    const cycleEdge = requireFirst(
      lineageEdges
        .filter((edge) => cycleSet.has(edge.from) && cycleSet.has(edge.to))
        .sort((left, right) => compareText(edgeSortKey(left), edgeSortKey(right))),
      'security cycle must contain an edge'
    );
    issues.push({
      code: 'SECURITY_LINEAGE_CYCLE',
      message: `Security lineage cycle includes ${cycleIds.join(', ')}`,
      objectType: cycleEdge.source.canonicalObjectType,
      objectId: cycleEdge.source.data.id,
      path: cycleEdge.path,
      referenceId: cycleIds[0],
      cycleIds,
    });
  }

  const rootIssuanceProducers = (securityId: string): SecurityProducer[] => {
    const roots: SecurityProducer[] = [];
    const visited = new Set<string>();
    const pending = [securityId];
    while (pending.length > 0) {
      const currentSecurityId = pending.pop();
      if (currentSecurityId === undefined || visited.has(currentSecurityId)) continue;
      visited.add(currentSecurityId);
      const producers = securityProducers.get(currentSecurityId) ?? [];
      if (producers.length !== 1) continue;
      const producer = requireFirst(producers, 'lineage producer must be present');
      if (producer.kind === 'issuance') {
        roots.push(producer);
        continue;
      }
      for (const inputId of [...producer.inputIds].sort(compareText).reverse()) pending.push(inputId);
    }
    return [
      ...new Map(
        roots.map((root) => [objectKey(root.source.canonicalObjectType, root.source.data.id), root] as const)
      ).values(),
    ].sort((left, right) =>
      compareText(
        objectKey(left.source.canonicalObjectType, left.source.data.id),
        objectKey(right.source.canonicalObjectType, right.source.data.id)
      )
    );
  };

  for (const terms of indexed.filter((item) => item.canonicalObjectType === 'VESTING_TERMS')) {
    if (!Array.isArray(terms.data.vesting_conditions)) continue;
    const conditionEntries = terms.data.vesting_conditions.flatMap((value, index) => {
      const condition = asRecord(value);
      return condition !== null && typeof condition.id === 'string' && condition.id.length > 0
        ? [{ condition, conditionId: condition.id, index }]
        : [];
    });
    const conditionsById = new Map<string, typeof conditionEntries>();
    for (const entry of conditionEntries) {
      const matches = conditionsById.get(entry.conditionId) ?? [];
      matches.push(entry);
      conditionsById.set(entry.conditionId, matches);
    }
    for (const [conditionId, matches] of conditionsById) {
      if (matches.length <= 1) continue;
      issues.push({
        code: 'DUPLICATE_VESTING_CONDITION_ID',
        message: `VESTING_TERMS ${terms.data.id} has duplicate vesting condition ${conditionId}`,
        objectType: 'VESTING_TERMS',
        objectId: terms.data.id,
        path: 'vesting_conditions',
        referenceId: conditionId,
        count: matches.length,
      });
    }

    const conditionEdges: DirectedGraphEdge[] = [];
    const addConditionReference = (
      from: string,
      to: string,
      path: string,
      edgeDirection: 'from-to' | 'to-from'
    ): void => {
      if (!conditionsById.has(to)) {
        issues.push({
          code: 'MISSING_VESTING_CONDITION',
          message: `VESTING_TERMS ${terms.data.id} ${path} references missing vesting condition ${to}`,
          objectType: 'VESTING_TERMS',
          objectId: terms.data.id,
          path,
          referenceId: to,
          targetObjectTypes: ['VESTING_TERMS'],
        });
        return;
      }
      if (from === to) {
        issues.push({
          code: 'SELF_VESTING_CONDITION_REFERENCE',
          message: `VESTING_TERMS ${terms.data.id} condition ${from} references itself`,
          objectType: 'VESTING_TERMS',
          objectId: terms.data.id,
          path,
          referenceId: from,
        });
        return;
      }
      conditionEdges.push(
        edgeDirection === 'from-to' ? { from, to, source: terms, path } : { from: to, to: from, source: terms, path }
      );
    };

    for (const entry of conditionEntries) {
      const nextConditionIds = entry.condition.next_condition_ids;
      if (Array.isArray(nextConditionIds)) {
        nextConditionIds.forEach((nextConditionId, nextIndex) => {
          if (typeof nextConditionId !== 'string' || nextConditionId.length === 0) return;
          addConditionReference(
            entry.conditionId,
            nextConditionId,
            `vesting_conditions[${entry.index}].next_condition_ids[${nextIndex}]`,
            'from-to'
          );
        });
      }
      const relativeToConditionId = asRecord(entry.condition.trigger)?.relative_to_condition_id;
      if (typeof relativeToConditionId === 'string' && relativeToConditionId.length > 0) {
        addConditionReference(
          entry.conditionId,
          relativeToConditionId,
          `vesting_conditions[${entry.index}].trigger.relative_to_condition_id`,
          'to-from'
        );
      }
    }

    for (const cycleIds of directedCycles(conditionsById.keys(), conditionEdges)) {
      const cycleSet = new Set(cycleIds);
      const cycleEdge = requireFirst(
        conditionEdges
          .filter((edge) => cycleSet.has(edge.from) && cycleSet.has(edge.to))
          .sort((left, right) => compareText(edgeSortKey(left), edgeSortKey(right))),
        'vesting cycle must contain an edge'
      );
      issues.push({
        code: 'VESTING_CONDITION_CYCLE',
        message: `VESTING_TERMS ${terms.data.id} condition cycle includes ${cycleIds.join(', ')}`,
        objectType: 'VESTING_TERMS',
        objectId: terms.data.id,
        path: cycleEdge.path,
        referenceId: cycleIds[0],
        cycleIds,
      });
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
    if (
      planMatches.length === 1 &&
      !stockPlanClassIds(requireFirst(planMatches, 'stock plan match must be present').data).has(classId)
    ) {
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
    const roots = rootIssuanceProducers(securityId);
    if (roots.length === 0) continue;
    const rootPlanIds = roots.map((root) => root.source.data.stock_plan_id);
    const actualPlanIds = [
      ...new Set(rootPlanIds.filter((planId): planId is string => typeof planId === 'string' && planId.length > 0)),
    ].sort(compareText);
    const hasNonPlanRoot = rootPlanIds.some((planId) => typeof planId !== 'string' || planId.length === 0);
    if (hasNonPlanRoot || actualPlanIds.length !== 1 || actualPlanIds[0] !== returnPlanId) {
      const actualPlanLabel =
        actualPlanIds.length > 0 ? actualPlanIds.join(', ') : hasNonPlanRoot ? 'no stock plan' : 'unknown stock plan';
      issues.push({
        code: 'STOCK_PLAN_SECURITY_MISMATCH',
        message: `${source.canonicalObjectType} ${source.data.id} returns security ${securityId} to stock plan ${returnPlanId}, but its lineage belongs to ${actualPlanLabel}`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.stock_plan_id',
        referenceId: returnPlanId,
        targetObjectTypes: ['TX_STOCK_ISSUANCE', 'TX_EQUITY_COMPENSATION_ISSUANCE'],
        ...(actualPlanIds.length === 1 ? { actualReferenceId: actualPlanIds[0] } : {}),
      });
    }
  }

  for (const issuance of indexed.filter((item) =>
    ['TX_CONVERTIBLE_ISSUANCE', 'TX_WARRANT_ISSUANCE'].includes(item.canonicalObjectType)
  )) {
    const issuanceField =
      issuance.canonicalObjectType === 'TX_CONVERTIBLE_ISSUANCE' ? 'conversion_triggers' : 'exercise_triggers';
    for (const [triggerId, count] of triggerIdCounts(issuance.data, issuanceField)) {
      if (count <= 1) continue;
      issues.push({
        code: 'DUPLICATE_TRIGGER_ID',
        message: `${issuance.canonicalObjectType} ${issuance.data.id} has duplicate trigger ${triggerId}`,
        objectType: issuance.canonicalObjectType,
        objectId: issuance.data.id,
        path: issuanceField,
        referenceId: triggerId,
        count,
      });
    }
  }

  const validateTransactionTrigger = (transactionType: string, family: SecurityFamily, issuanceField: string): void => {
    for (const source of indexed.filter((item) => item.canonicalObjectType === transactionType)) {
      if (typeof source.data.security_id !== 'string' || typeof source.data.trigger_id !== 'string') continue;
      const roots = rootIssuanceProducers(source.data.security_id).filter((root) => root.family === family);
      if (roots.length !== 1) continue;
      const root = requireFirst(roots, 'trigger lineage root must be present');
      const triggerCount = triggerIdCounts(root.source.data, issuanceField).get(source.data.trigger_id) ?? 0;
      if (triggerCount === 0) {
        issues.push({
          code: 'MISSING_TRIGGER',
          message: `${source.canonicalObjectType} ${source.data.id} references missing trigger ${source.data.trigger_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: 'trigger_id',
          referenceId: source.data.trigger_id,
          targetObjectTypes: [ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]],
        });
      } else if (triggerCount > 1) {
        issues.push({
          code: 'AMBIGUOUS_TRIGGER',
          message: `${source.canonicalObjectType} ${source.data.id} references ambiguous trigger ${source.data.trigger_id}`,
          objectType: source.canonicalObjectType,
          objectId: source.data.id,
          path: 'trigger_id',
          referenceId: source.data.trigger_id,
          targetObjectTypes: [ISSUANCE_OBJECT_TYPE_BY_FAMILY[family]],
          count: triggerCount,
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
    const roots = rootIssuanceProducers(source.data.security_id);
    if (roots.length === 0) continue;
    const rootVestingTermsIds = roots.map((root) => root.source.data.vesting_terms_id);
    const vestingTermsIds = [
      ...new Set(
        rootVestingTermsIds.filter(
          (vestingTermsId): vestingTermsId is string => typeof vestingTermsId === 'string' && vestingTermsId.length > 0
        )
      ),
    ].sort(compareText);
    if (
      vestingTermsIds.length === 0 ||
      rootVestingTermsIds.some((vestingTermsId) => typeof vestingTermsId !== 'string' || vestingTermsId.length === 0)
    ) {
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
    if (vestingTermsIds.length > 1) {
      issues.push({
        code: 'AMBIGUOUS_SECURITY_REFERENCE',
        message: `${source.canonicalObjectType} ${source.data.id} security ${source.data.security_id} has multiple vesting terms`,
        objectType: source.canonicalObjectType,
        objectId: source.data.id,
        path: 'security_id.vesting_terms_id',
        referenceId: source.data.security_id,
        targetObjectTypes: ['VESTING_TERMS'],
        count: vestingTermsIds.length,
      });
      continue;
    }
    const vestingTermsId = requireFirst(vestingTermsIds, 'vesting terms id must be present');
    const vestingTermsMatches = objectsByKey.get(objectKey('VESTING_TERMS', vestingTermsId)) ?? [];
    if (vestingTermsMatches.length !== 1) continue;
    const conditions = requireFirst(vestingTermsMatches, 'vesting terms match must be present').data.vesting_conditions;
    const matchingConditions = Array.isArray(conditions)
      ? conditions
          .map(asRecord)
          .filter(
            (candidate): candidate is Readonly<Record<string, unknown>> =>
              candidate?.id === source.data.vesting_condition_id
          )
      : [];
    if (matchingConditions.length === 0) {
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
    if (matchingConditions.length !== 1) continue;
    const condition = requireFirst(matchingConditions, 'matching vesting condition must be present');
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
