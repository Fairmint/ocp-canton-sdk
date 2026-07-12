import fs from 'fs';
import path from 'path';
import { format, resolveConfig } from 'prettier';
import {
  inventoryCanonicalOcfPublicTypes,
  inventoryReachableObjectSchemas,
} from '../test/schemaAlignment/schemaConformanceHarness';

const repoRoot = path.resolve(__dirname, '..');
const inventoryPath = path.join(repoRoot, 'test', 'schemaAlignment', 'canonicalOcfObjectInventory.json');

async function main(): Promise<void> {
  const inventory = inventoryCanonicalOcfPublicTypes(repoRoot);
  const schemaInventory = inventoryReachableObjectSchemas(path.join(repoRoot, 'libs', 'Open-Cap-Format-OCF', 'schema'));
  const prettierConfig = (await resolveConfig(inventoryPath)) ?? {};
  const formattedInventory = await format(JSON.stringify(inventory), { ...prettierConfig, filepath: inventoryPath });

  fs.writeFileSync(inventoryPath, formattedInventory);
  console.log(
    `Wrote ${inventory.objects.length} canonical OCF object shapes and ` +
      `${Object.keys(inventory.schemaIngestionAliases).length} schema-ingestion aliases to ${inventoryPath}`
  );
  console.log(
    `Reachable schema fingerprint: ${schemaInventory.fingerprint} ` +
      `(${schemaInventory.objectSchemaCount} objects, ${schemaInventory.reachableSchemaCount} resources)`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
