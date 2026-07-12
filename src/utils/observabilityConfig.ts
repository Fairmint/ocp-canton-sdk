import { OcpErrorCodes, OcpValidationError } from '../errors';
import type {
  CommandContext,
  CommandObservabilityOptions,
  OcpObservabilityOptions,
  SdkLogger,
  SdkMetrics,
} from '../observabilityTypes';
import { snapshotCommandContext } from './commandContext';
import {
  inspectCallableDataProperty,
  inspectExactObject,
  type ExactDataFailure,
  type ExactObjectSnapshot,
} from './exactObject';

const OCP_OBSERVABILITY_KEYS = new Set(['logger', 'metrics', 'defaultContext']);
const COMMAND_OBSERVABILITY_KEYS = new Set([...OCP_OBSERVABILITY_KEYS, 'context']);
const LOGGER_METHODS = ['debug', 'info', 'warn', 'error'] as const;
const METRICS_METHODS = ['commandSubmitted', 'commandSucceeded', 'commandFailed'] as const;

function throwServiceFailure(root: string, service: string, failure: ExactDataFailure): never {
  const fieldPath = typeof failure.key === 'string' ? `${root}.${failure.key}` : root;
  throw new OcpValidationError(
    fieldPath,
    `${service} must expose callable data methods without accessors or proxies.`,
    {
      code: failure.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
      expectedType: `${service} service object`,
      receivedValue: failure.receivedValue,
      context: { reason: failure.reason },
    }
  );
}

function validateService(value: unknown, root: string, service: string, methods: readonly string[]): void {
  for (const method of methods) {
    const inspection = inspectCallableDataProperty(value, method);
    if (!inspection.ok) throwServiceFailure(root, service, inspection);
  }
}

export function validateSdkLogger(value: unknown, root = 'logger'): SdkLogger {
  validateService(value, root, 'SDK logger', LOGGER_METHODS);
  return value as SdkLogger;
}

export function validateSdkMetrics(value: unknown, root = 'metrics'): SdkMetrics {
  validateService(value, root, 'SDK metrics', METRICS_METHODS);
  return value as SdkMetrics;
}

export function snapshotOcpObservabilityComponents(
  loggerValue: unknown,
  metricsValue: unknown,
  defaultContextValue: unknown,
  root = 'observability'
): Readonly<OcpObservabilityOptions> {
  const logger = loggerValue === undefined ? undefined : validateSdkLogger(loggerValue, `${root}.logger`);
  const metrics = metricsValue === undefined ? undefined : validateSdkMetrics(metricsValue, `${root}.metrics`);
  const defaultContext = snapshotCommandContext(defaultContextValue, `${root}.defaultContext`);
  return Object.freeze({
    ...(logger !== undefined ? { logger } : {}),
    ...(metrics !== undefined ? { metrics } : {}),
    ...(defaultContext !== undefined ? { defaultContext } : {}),
  });
}

function throwObservabilityObjectFailure(root: string, failure: ExactDataFailure): never {
  const fieldPath = typeof failure.key === 'string' ? `${root}.${failure.key}` : root;
  throw new OcpValidationError(
    fieldPath,
    `observability options must be an exact plain object with own data properties; rejected ${failure.reason}.`,
    {
      code: failure.reason === 'invalid_type' ? OcpErrorCodes.INVALID_TYPE : OcpErrorCodes.INVALID_FORMAT,
      expectedType: 'exact plain observability options object',
      receivedValue: failure.receivedValue,
      context: { reason: failure.reason },
    }
  );
}

export function snapshotCommandObservabilityOptions(
  value: unknown,
  root = 'observability'
): Readonly<CommandObservabilityOptions> | undefined {
  if (value === undefined) return undefined;
  const inspection = inspectExactObject(value, { allowedKeys: COMMAND_OBSERVABILITY_KEYS });
  if (!inspection.ok) throwObservabilityObjectFailure(root, inspection);
  return snapshotCommandObservabilityValues(inspection.snapshot, root);
}

function snapshotCommandObservabilityValues(
  snapshot: ExactObjectSnapshot,
  root: string
): Readonly<CommandObservabilityOptions> | undefined {
  for (const key of COMMAND_OBSERVABILITY_KEYS) {
    if (snapshot.has(key) && snapshot.get(key) === undefined) {
      throw new OcpValidationError(`${root}.${key}`, `${key} must be omitted rather than set to undefined.`, {
        code: OcpErrorCodes.INVALID_TYPE,
        expectedType: 'defined value or omitted property',
      });
    }
  }

  const base = snapshotOcpObservabilityComponents(
    snapshot.get('logger'),
    snapshot.get('metrics'),
    snapshot.get('defaultContext'),
    root
  );
  const context: CommandContext | undefined = snapshotCommandContext(snapshot.get('context'), `${root}.context`);
  return Object.freeze({
    ...base,
    ...(context !== undefined ? { context } : {}),
  });
}

/** Extract observability fields from a larger command parameter object without invoking accessors. */
export function snapshotCommandObservabilityCarrier(
  value: unknown,
  root = 'commandOptions'
): Readonly<CommandObservabilityOptions> | undefined {
  return snapshotCommandCarrier(value, root).observability;
}

export interface SnapshottedCommandCarrier {
  readonly snapshot: ExactObjectSnapshot;
  readonly observability: Readonly<CommandObservabilityOptions> | undefined;
}

export function snapshotCommandCarrier(value: unknown, root = 'commandOptions'): SnapshottedCommandCarrier {
  const inspection = inspectExactObject(value);
  if (!inspection.ok) throwObservabilityObjectFailure(root, inspection);
  return Object.freeze({
    snapshot: inspection.snapshot,
    observability: snapshotCommandObservabilityValues(inspection.snapshot, root),
  });
}
