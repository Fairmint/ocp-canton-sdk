/**
 * Utility functions for loading OCF test fixtures from the production and synthetic directories.
 *
 * These utilities support loading anonymized production data and synthetic fixtures for
 * integration testing of the OCP SDK.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Base directory for all test fixtures. */
const FIXTURES_BASE_DIR = path.join(__dirname, '../fixtures');

/**
 * Load a fixture from the production or synthetic directories.
 *
 * @param relativePath - Path relative to the fixtures directory (e.g., 'production/issuer/basic.json' or 'synthetic/stockAcceptance.json')
 * @returns The parsed JSON fixture as an unknown-valued object record
 * @throws Error if the fixture file does not exist, cannot be parsed, or does not contain an object at its root
 *
 * @example
 * ```typescript
 * // Load a production fixture
 * const issuer = loadFixture('production/issuer/basic.json');
 *
 * // Load a synthetic fixture
 * const acceptance = loadFixture('synthetic/stockAcceptance.json');
 * ```
 */
function isFixtureRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireFixtureRecord(value: unknown, relativePath: string): Record<string, unknown> {
  if (!isFixtureRecord(value)) {
    throw new Error(`Fixture ${relativePath} must contain a JSON object`);
  }
  return value;
}

export function loadFixture(relativePath: string): Record<string, unknown> {
  const absolutePath = path.join(FIXTURES_BASE_DIR, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Fixture not found: ${relativePath} (looked at ${absolutePath})`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  try {
    const parsed: unknown = JSON.parse(content);
    return requireFixtureRecord(parsed, relativePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse fixture ${relativePath}: ${message}`);
  }
}

/**
 * Load a production fixture by type and variant.
 *
 * @param type - The OCF type (e.g., 'issuer', 'stakeholder', 'stockIssuance')
 * @param variant - Optional variant name (e.g., 'basic', 'with-full-details', 'individual')
 * @returns The parsed fixture data
 *
 * @example
 * ```typescript
 * // Load basic issuer fixture
 * const issuer = loadProductionFixture('issuer', 'basic');
 *
 * // Load individual stakeholder fixture
 * const stakeholder = loadProductionFixture('stakeholder', 'individual');
 *
 * // Load single-file fixture (no variant)
 * const transfer = loadProductionFixture('stockTransfer');
 * ```
 */
export function loadProductionFixture(type: string, variant?: string): Record<string, unknown> {
  const relativePath = variant ? `production/${type}/${variant}.json` : `production/${type}.json`;

  return loadFixture(relativePath);
}

/**
 * Load a synthetic fixture by type.
 *
 * @param type - The OCF type (e.g., 'stockAcceptance', 'warrantExercise')
 * @returns The parsed fixture data
 *
 * @example
 * ```typescript
 * const acceptance = loadSyntheticFixture('stockAcceptance');
 * ```
 */
export function loadSyntheticFixture(type: string): Record<string, unknown> {
  return loadFixture(`synthetic/${type}.json`);
}

/**
 * Strip the _source metadata field from a fixture for comparison or API submission.
 *
 * @param fixture - The fixture data with potential _source field
 * @returns The fixture data without the _source field
 */
export function stripSourceMetadata<T extends Record<string, unknown>>(fixture: T): Omit<T, '_source'> {
  const { _source, ...rest } = fixture;
  return rest;
}

/** Identifiers used to make one fixture unique for an integration-test run. */
export interface PreparedFixtureIdentifiers {
  id: string;
  securityId: string;
}

/**
 * Remove source-only metadata and replace identifiers that must be unique on the ledger.
 *
 * Validate every source identifier before replacing it so fixture preparation cannot turn
 * malformed source data into a valid payload and hide a broken production fixture.
 */
export function prepareFixtureForSubmission(
  fixture: Record<string, unknown>,
  identifiers: PreparedFixtureIdentifiers
): Record<string, unknown> {
  const cleaned = stripSourceMetadata(fixture);
  if (typeof cleaned.id !== 'string') {
    throw new Error('Fixture field id must be a string');
  }

  const hasSecurityId = Object.prototype.hasOwnProperty.call(cleaned, 'security_id');
  if (hasSecurityId && typeof cleaned.security_id !== 'string') {
    throw new Error('Fixture field security_id must be a string when present');
  }

  return {
    ...cleaned,
    id: identifiers.id,
    ...(hasSecurityId ? { security_id: identifiers.securityId } : {}),
  };
}
