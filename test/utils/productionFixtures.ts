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
 * @returns The parsed JSON fixture data
 * @throws Error if the fixture file does not exist or cannot be parsed
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
export function loadFixture<T = unknown>(relativePath: string): T {
  const absolutePath = path.join(FIXTURES_BASE_DIR, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Fixture not found: ${relativePath} (looked at ${absolutePath})`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  try {
    return JSON.parse(content) as T;
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
export function loadProductionFixture<T = unknown>(type: string, variant?: string): T {
  const relativePath = variant ? `production/${type}/${variant}.json` : `production/${type}.json`;

  return loadFixture<T>(relativePath);
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
export function loadSyntheticFixture<T = unknown>(type: string): T {
  return loadFixture<T>(`synthetic/${type}.json`);
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
