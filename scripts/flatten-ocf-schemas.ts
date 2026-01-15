#!/usr/bin/env ts-node

/**
 * Flatten OCF Schemas Script
 *
 * Reads OCF JSON schema files from the objects directory, dereferences all $ref references to create flattened,
 * self-contained schema files.
 *
 * Usage: npm run flatten-schemas
 *
 * Output: generated/ocf-schema/{SchemaName}.schema.json
 */

import $RefParser, { type FileInfo, type ResolverOptions } from '@apidevtools/json-schema-ref-parser';
import fs from 'fs';
import path from 'path';

// Base paths
const REPO_ROOT = path.resolve(__dirname, '..');
const OCF_SCHEMA_ROOT = path.join(REPO_ROOT, 'Open-Cap-Format-OCF', 'schema');
const OBJECTS_DIR = path.join(OCF_SCHEMA_ROOT, 'objects');
const OUTPUT_DIR = path.join(REPO_ROOT, 'generated', 'ocf-schema');

// GitHub raw URL base that needs to be mapped to local files
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/';

interface JsonSchema {
  $schema?: string;
  $id?: string;
  $comment?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  items?: JsonSchema | JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}

/** Recursively find all .schema.json files in a directory */
function findSchemaFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.schema.json')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/** Remove metadata fields that aren't needed for understanding the schema */
function cleanSchema(schema: JsonSchema, isTopLevel = true): JsonSchema {
  const cleaned: JsonSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    // Skip metadata fields
    if (key === '$comment' || key === '$id') {
      continue;
    }

    // Skip $schema in nested objects (keep only at top level)
    if (key === '$schema' && !isTopLevel) {
      continue;
    }

    // Recursively clean nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = cleanSchema(value as JsonSchema, false);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? cleanSchema(item as JsonSchema, false) : item
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/** Check if a property schema is empty (has no keys) */
function isEmptyPropertySchema(propSchema: JsonSchema): boolean {
  return Object.keys(propSchema).length === 0;
}

/** Merge a property into the properties map, handling empty schemas */
function mergeProperty(mergedProperties: Record<string, JsonSchema>, propName: string, propSchema: JsonSchema): void {
  const isEmpty = isEmptyPropertySchema(propSchema);

  // If we already have a property and the new one is empty, keep existing
  if (propName in mergedProperties && isEmpty) {
    return;
  }

  // If we have an existing non-empty property and new is non-empty, merge them
  if (propName in mergedProperties && !isEmpty) {
    mergedProperties[propName] = {
      ...mergedProperties[propName],
      ...propSchema,
    };
  } else {
    // Either no existing property, or new property replaces empty existing
    mergedProperties[propName] = propSchema;
  }
}

/** Merge allOf schemas into a single flat schema */
function mergeAllOf(schema: JsonSchema): JsonSchema {
  if (!schema.allOf || schema.allOf.length === 0) {
    return schema;
  }

  // Start with the base schema (without allOf)
  const { allOf, ...baseSchema } = schema;

  // Collect merged properties and required fields
  const mergedProperties: Record<string, JsonSchema> = {};
  const mergedRequired = new Set<string>();

  // Process each schema in allOf
  for (const subSchema of allOf) {
    // Recursively merge if the subschema also has allOf
    const processedSubSchema = mergeAllOf(subSchema);

    // Merge properties
    if (processedSubSchema.properties) {
      for (const [propName, propSchema] of Object.entries(processedSubSchema.properties)) {
        mergeProperty(mergedProperties, propName, propSchema);
      }
    }

    // Merge required fields
    if (processedSubSchema.required) {
      for (const field of processedSubSchema.required) {
        mergedRequired.add(field);
      }
    }
  }

  // Also merge properties from the base schema
  if (baseSchema.properties) {
    for (const [propName, propSchema] of Object.entries(baseSchema.properties)) {
      mergeProperty(mergedProperties, propName, propSchema);
    }
  }

  // Merge required from base schema
  if (baseSchema.required) {
    for (const field of baseSchema.required) {
      mergedRequired.add(field);
    }
  }

  // Build the merged schema
  const mergedSchema: JsonSchema = {
    ...baseSchema,
  };

  if (Object.keys(mergedProperties).length > 0) {
    mergedSchema.properties = mergedProperties;
  }

  if (mergedRequired.size > 0) {
    mergedSchema.required = Array.from(mergedRequired);
  }

  return mergedSchema;
}

/** Remove empty property definitions (empty objects {}) */
function removeEmptyProperties(schema: JsonSchema): JsonSchema {
  if (!schema.properties) {
    return schema;
  }

  const cleanedProperties: Record<string, JsonSchema> = {};

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    // Skip empty property definitions
    if (typeof propSchema === 'object' && Object.keys(propSchema as object).length === 0) {
      continue;
    }
    cleanedProperties[propName] = propSchema;
  }

  return {
    ...schema,
    properties: cleanedProperties,
  };
}

/** Convert a URL to a local file path */
function urlToLocalPath(url: string): string {
  if (url.startsWith(GITHUB_RAW_BASE)) {
    const relativePath = url.slice(GITHUB_RAW_BASE.length);
    return path.join(REPO_ROOT, 'Open-Cap-Format-OCF', relativePath);
  }
  if (url.startsWith('file://')) {
    return url.slice(7);
  }
  return url;
}

/** Custom resolver that maps all URLs to local files */
const customResolver: ResolverOptions = {
  order: 1,
  canRead: (): boolean => true, // Handle all URLs
  read: (file: FileInfo): string => {
    const localPath = urlToLocalPath(file.url);
    return fs.readFileSync(localPath, 'utf8');
  },
};

/** Flatten a single schema file */
async function flattenSchema(schemaPath: string): Promise<JsonSchema> {
  // Read the schema content first
  const schemaContent = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as JsonSchema;

  // Dereference all $ref pointers
  const dereferenced = await $RefParser.dereference(schemaPath, schemaContent, {
    resolve: {
      file: customResolver,
      http: customResolver,
    },
    dereference: {
      circular: 'ignore', // Handle circular references gracefully
    },
  });

  // Merge allOf constructs
  const merged = mergeAllOf(dereferenced as unknown as JsonSchema);

  // Remove empty property definitions
  const withoutEmpty = removeEmptyProperties(merged);

  // Clean metadata fields
  const cleaned = cleanSchema(withoutEmpty);

  return cleaned;
}

/**
 * Get the output filename from the input path Flattens the directory structure (e.g.,
 * transactions/issuance/StockIssuance.schema.json -> StockIssuance.schema.json)
 */
function getOutputFilename(inputPath: string): string {
  return path.basename(inputPath);
}

/** Main function */
async function main(): Promise<void> {
  console.log('OCF Schema Flattener');
  console.log('====================\n');

  // Check that the OCF submodule exists
  if (!fs.existsSync(OBJECTS_DIR)) {
    console.error(`Error: OCF schema directory not found at ${OBJECTS_DIR}`);
    console.error('Make sure the Open-Cap-Format-OCF submodule is initialized:');
    console.error('  git submodule update --init --recursive');
    process.exit(1);
  }

  // Find all schema files
  const schemaFiles = findSchemaFiles(OBJECTS_DIR);
  console.log(`Found ${schemaFiles.length} schema files to process\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Track filenames to detect duplicates
  const seenFilenames = new Map<string, string>();

  // Process each schema
  let successCount = 0;
  let errorCount = 0;

  for (const schemaPath of schemaFiles) {
    const relativePath = path.relative(OBJECTS_DIR, schemaPath);
    const outputFilename = getOutputFilename(schemaPath);

    // Check for duplicate filenames
    if (seenFilenames.has(outputFilename)) {
      console.warn(
        `Warning: Duplicate filename "${outputFilename}" from "${relativePath}" ` +
          `(already seen from "${seenFilenames.get(outputFilename)}")`
      );
    }
    seenFilenames.set(outputFilename, relativePath);

    try {
      const flattened = await flattenSchema(schemaPath);
      const outputPath = path.join(OUTPUT_DIR, outputFilename);

      fs.writeFileSync(outputPath, `${JSON.stringify(flattened, null, 2)}\n`);

      console.log(`✓ ${relativePath} -> ${outputFilename}`);
      successCount++;
    } catch (error) {
      console.error(`✗ ${relativePath}: ${(error as Error).message}`);
      errorCount++;
    }
  }

  console.log('\n====================');
  console.log(`Processed: ${successCount} succeeded, ${errorCount} failed`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
