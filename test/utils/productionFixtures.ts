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

/** Directory containing production-derived fixtures. */
const PRODUCTION_DIR = path.join(FIXTURES_BASE_DIR, 'production');

/** Directory containing synthetic fixtures. */
const SYNTHETIC_DIR = path.join(FIXTURES_BASE_DIR, 'synthetic');

/**
 * Fixture metadata indicating the source of the fixture data.
 */
export interface FixtureMetadata {
  /** Whether this fixture is from production or synthetic data. */
  source: 'production' | 'synthetic';
  /** The file path relative to the fixtures directory. */
  relativePath: string;
  /** The absolute file path. */
  absolutePath: string;
}

/**
 * A loaded fixture with its data and metadata.
 */
export interface LoadedFixture<T = unknown> {
  /** The fixture data. */
  data: T;
  /** Metadata about the fixture. */
  metadata: FixtureMetadata;
}

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
 * Load a fixture with metadata about its source.
 *
 * @param relativePath - Path relative to the fixtures directory
 * @returns The parsed fixture data with metadata
 *
 * @example
 * ```typescript
 * const { data, metadata } = loadFixtureWithMetadata('production/issuer/basic.json');
 * console.log(`Loaded ${metadata.source} fixture from ${metadata.relativePath}`);
 * ```
 */
export function loadFixtureWithMetadata<T = unknown>(relativePath: string): LoadedFixture<T> {
  const data = loadFixture<T>(relativePath);
  const absolutePath = path.join(FIXTURES_BASE_DIR, relativePath);
  const source = relativePath.startsWith('production/') ? 'production' : 'synthetic';

  return {
    data,
    metadata: {
      source,
      relativePath,
      absolutePath,
    },
  };
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
 * List all fixture files in a directory.
 *
 * @param directory - The directory to list ('production' or 'synthetic')
 * @param type - Optional type filter (e.g., 'issuer', 'stakeholder')
 * @returns Array of relative paths to fixture files
 *
 * @example
 * ```typescript
 * // List all production fixtures
 * const allProduction = listFixtures('production');
 *
 * // List all issuer fixtures
 * const issuers = listFixtures('production', 'issuer');
 * ```
 */
export function listFixtures(directory: 'production' | 'synthetic', type?: string): string[] {
  const baseDir = directory === 'production' ? PRODUCTION_DIR : SYNTHETIC_DIR;
  const searchDir = type ? path.join(baseDir, type) : baseDir;

  if (!fs.existsSync(searchDir)) {
    return [];
  }

  const results: string[] = [];

  function walkDir(dir: string, prefix: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, relativePath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(`${directory}/${relativePath}`);
      }
    }
  }

  walkDir(searchDir, type ?? '');

  return results.sort();
}

/**
 * Get all available OCF types from the fixtures directories.
 *
 * @returns Object with arrays of production and synthetic types
 *
 * @example
 * ```typescript
 * const { production, synthetic } = getAvailableTypes();
 * console.log('Production types:', production);
 * console.log('Synthetic types:', synthetic);
 * ```
 */
export function getAvailableTypes(): { production: string[]; synthetic: string[] } {
  const productionTypes = new Set<string>();
  const syntheticTypes = new Set<string>();

  // Get production types
  if (fs.existsSync(PRODUCTION_DIR)) {
    const entries = fs.readdirSync(PRODUCTION_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        productionTypes.add(entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'README.md') {
        productionTypes.add(entry.name.replace('.json', ''));
      }
    }
  }

  // Get synthetic types
  if (fs.existsSync(SYNTHETIC_DIR)) {
    const entries = fs.readdirSync(SYNTHETIC_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        syntheticTypes.add(entry.name.replace('.json', ''));
      }
    }
  }

  return {
    production: Array.from(productionTypes).sort(),
    synthetic: Array.from(syntheticTypes).sort(),
  };
}

/**
 * Check if a fixture is from synthetic data (has _source: "synthetic" field).
 *
 * @param fixture - The fixture data to check
 * @returns True if the fixture has _source: "synthetic"
 */
export function isSyntheticFixture(fixture: unknown): boolean {
  if (typeof fixture !== 'object' || fixture === null) {
    return false;
  }
  return (fixture as Record<string, unknown>)['_source'] === 'synthetic';
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
