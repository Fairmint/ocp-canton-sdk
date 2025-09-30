import * as fs from 'fs';
import * as path from 'path';

interface RawItem {
  id: string;
  object_type: string;
  [key: string]: unknown;
}

interface OldFixture {
  timestamp: string;
  url: string;
  request: {
    method: string;
    headers: Record<string, string>;
    data: {
      commands: Array<Record<string, unknown>>;
      actAs: string[];
      disclosedContracts: Array<Record<string, unknown>>;
      commandId?: string;
    };
  };
  response: {
    transactionTree: Record<string, unknown>;
  };
}

interface TestContext {
  issuerContractId: string;
  issuerParty: string;
  [key: string]: unknown;
}

interface MergedFixture {
  functionName: string;
  dbInput: Record<string, unknown>;
  testContext: TestContext;
  expectedRequest: {
    commands: Array<Record<string, unknown>>;
    actAs: string[];
    disclosedContracts: Array<Record<string, unknown>>;
  };
  expectedResponse: {
    transactionTree: Record<string, unknown>;
  };
}

function findRawItemForFixture(fixtureName: string, oldFixture: OldFixture, rawItemsDir: string): string | null {
  // Extract ID from the choiceArgument in the fixture
  const command = oldFixture.request.data.commands[0];
  const exerciseCommand = (command as any).ExerciseCommand;
  
  if (!exerciseCommand || !exerciseCommand.choiceArgument) {
    console.warn(`No choiceArgument found in ${fixtureName}`);
    return null;
  }

  // Find the data field (it varies by type)
  const choiceArg = exerciseCommand.choiceArgument;
  let dataField: Record<string, unknown> | null = null;
  let id: string | null = null;

  // Try different field names
  const possibleFields = [
    'document_data',
    'stock_class_data',
    'stakeholder_data',
    'stock_legend_template_data',
    'vesting_terms_data',
    'stock_plan_data',
    'transaction_data'
  ];

  for (const field of possibleFields) {
    if (choiceArg[field]) {
      dataField = choiceArg[field] as Record<string, unknown>;
      id = dataField.id as string;
      break;
    }
  }

  if (!id) {
    console.warn(`No ID found in choiceArgument for ${fixtureName}`);
    return null;
  }

  // Find matching raw item file
  const rawItemFiles = fs.readdirSync(rawItemsDir);
  
  for (const filename of rawItemFiles) {
    if (filename.includes(id.substring(0, 8))) {
      return path.join(rawItemsDir, filename);
    }
  }

  console.warn(`No raw item found for ID ${id} in fixture ${fixtureName}`);
  return null;
}

function extractTestContext(oldFixture: OldFixture): TestContext {
  const command = oldFixture.request.data.commands[0];
  const exerciseCommand = (command as any).ExerciseCommand;
  
  return {
    issuerContractId: exerciseCommand.contractId,
    issuerParty: oldFixture.request.data.actAs[0]
  };
}

function cleanDateStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    // Fix duplicated date strings like "2024-06-30T00:00:00.000ZT00:00:00.000Z"
    if (obj.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}ZT\d{2}:\d{2}:\d{2}\.\d{3}Z/)) {
      // Remove the duplicate time portion
      return obj.replace(/T\d{2}:\d{2}:\d{2}\.\d{3}Z(T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/, '$1');
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(cleanDateStrings);
  }
  
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanDateStrings(value);
    }
    return cleaned;
  }
  
  return obj;
}

function generateMergedFixture(
  functionName: string,
  oldFixture: OldFixture,
  rawItemPath: string | null
): MergedFixture | null {
  const testContext = extractTestContext(oldFixture);
  
  let dbInput: Record<string, unknown> | null = null;
  
  if (rawItemPath && fs.existsSync(rawItemPath)) {
    const rawItemContent = fs.readFileSync(rawItemPath, 'utf-8');
    dbInput = JSON.parse(rawItemContent);
  } else {
    // If no raw item, extract from choiceArgument
    const command = oldFixture.request.data.commands[0];
    const exerciseCommand = (command as any).ExerciseCommand;
    const choiceArg = exerciseCommand.choiceArgument;
    
    const possibleFields = [
      'document_data',
      'stock_class_data',
      'stakeholder_data',
      'stock_legend_template_data',
      'template_data',
      'vesting_terms_data',
      'stock_plan_data',
      'plan_data',
      'transaction_data',
      'transactionData',
      'issuance_data',
      'cancellation_data',
      'adjustment_data',
      'exercise_data'
    ];

    for (const field of possibleFields) {
      if (choiceArg[field]) {
        dbInput = choiceArg[field];
        break;
      }
    }
  }

  if (!dbInput) {
    console.warn(`Could not extract dbInput for ${functionName}`);
    return null;
  }

  // Clean up the data
  const cleanedDbInput = cleanDateStrings(dbInput) as Record<string, unknown>;
  
  // Ensure object_type is present for proper destructuring
  if (!cleanedDbInput.object_type) {
    // Infer object type from function name
    const typeMap: Record<string, string> = {
      'createDocument': 'DOCUMENT',
      'createStockClass': 'STOCK_CLASS',
      'createStakeholder': 'STAKEHOLDER',
      'createStockLegendTemplate': 'STOCK_LEGEND_TEMPLATE',
      'createVestingTerms': 'VESTING_TERMS',
      'createStockPlan': 'STOCK_PLAN',
      'createConvertibleIssuance': 'TX_CONVERTIBLE_ISSUANCE',
      'createWarrantIssuance': 'TX_WARRANT_ISSUANCE',
      'createStockIssuance': 'TX_STOCK_ISSUANCE',
      'createStockCancellation': 'TX_STOCK_CANCELLATION',
      'createIssuerAuthorizedSharesAdjustment': 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT',
      'createStockClassAuthorizedSharesAdjustment': 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT',
      'createStockPlanPoolAdjustment': 'TX_STOCK_PLAN_POOL_ADJUSTMENT',
      'createEquityCompensationExercise': 'TX_EQUITY_COMPENSATION_EXERCISE'
    };
    
    if (typeMap[functionName]) {
      cleanedDbInput.object_type = typeMap[functionName];
    }
  }

  const { commandId, ...requestWithoutCommandId } = oldFixture.request.data;

  return {
    functionName,
    dbInput: cleanedDbInput,
    testContext,
    expectedRequest: requestWithoutCommandId,
    expectedResponse: oldFixture.response
  };
}

function main() {
  const testDir = path.join(__dirname, '..');
  const oldFixturesDir = path.join(testDir, 'fixtures/ocpClient');
  const rawItemsDir = path.join(oldFixturesDir, 'rawItems');
  const outputDir = path.join(testDir, 'fixtures/createOcf');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // List of create functions to migrate
  const createFunctions = [
    'createDocument',
    'createStockClass',
    'createStakeholder',
    'createStockLegendTemplate',
    'createVestingTerms',
    'createStockPlan',
    'createConvertibleIssuance',
    'createWarrantIssuance',
    'createStockIssuance',
    'createStockCancellation',
    'createIssuerAuthorizedSharesAdjustment',
    'createStockClassAuthorizedSharesAdjustment',
    'createStockPlanPoolAdjustment',
    'createEquityCompensationExercise'
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const functionName of createFunctions) {
    const oldFixturePath = path.join(oldFixturesDir, `${functionName}.json`);
    
    if (!fs.existsSync(oldFixturePath)) {
      console.log(`⏭️  Skipping ${functionName} - no fixture found`);
      skipCount++;
      continue;
    }

    const oldFixtureContent = fs.readFileSync(oldFixturePath, 'utf-8');
    const oldFixture: OldFixture = JSON.parse(oldFixtureContent);

    const rawItemPath = findRawItemForFixture(functionName, oldFixture, rawItemsDir);
    const mergedFixture = generateMergedFixture(functionName, oldFixture, rawItemPath);

    if (!mergedFixture) {
      console.log(`❌ Failed to generate ${functionName}`);
      continue;
    }

    const outputPath = path.join(outputDir, `${functionName}-minimal.json`);
    fs.writeFileSync(outputPath, JSON.stringify(mergedFixture, null, 2));
    
    console.log(`✅ Generated ${functionName}-minimal.json`);
    successCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Generated: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`\nMerged fixtures saved to: ${outputDir}`);
}

main();
