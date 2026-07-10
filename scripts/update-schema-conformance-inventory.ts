import fs from 'fs';
import path from 'path';
import { format, resolveConfig } from 'prettier';
import {
  inventoryCanonicalOcfObjects,
  inventoryReachableObjectSchemas,
} from '../test/schemaAlignment/schemaConformanceHarness';

const repoRoot = path.resolve(__dirname, '..');
const inventoryPath = path.join(repoRoot, 'test', 'schemaAlignment', 'canonicalOcfObjectInventory.json');

async function main(): Promise<void> {
  const inventory = inventoryCanonicalOcfObjects(repoRoot);
  const schemaInventory = inventoryReachableObjectSchemas(path.join(repoRoot, 'libs', 'Open-Cap-Format-OCF', 'schema'));
  const prettierConfig = (await resolveConfig(inventoryPath)) ?? {};
  const formattedInventory = await format(JSON.stringify(inventory), { ...prettierConfig, filepath: inventoryPath });

  fs.writeFileSync(inventoryPath, formattedInventory);
  console.log(`Wrote ${inventory.length} canonical OCF object shapes to ${inventoryPath}`);
  console.log(
    `Reachable schema fingerprint: ${schemaInventory.fingerprint} ` +
      `(${schemaInventory.objectSchemaCount} objects, ${schemaInventory.reachableSchemaCount} resources)`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
