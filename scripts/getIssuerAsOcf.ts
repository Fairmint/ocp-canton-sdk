#!/usr/bin/env ts-node

import { OcpClient } from '../src';

async function main() {
  try {
    console.log('🚀 Starting getIssuerAsOcf script...');
    
    // Get contract ID from command line arguments or environment
    const contractId = process.argv[2] || process.env.ISSUER_CONTRACT_ID;
    
    if (!contractId) {
      console.error('❌ Error: Issuer contract ID is required');
      console.log('Usage: npm run script:get-issuer-ocf <issuer-contract-id>');
      console.log('   or set ISSUER_CONTRACT_ID environment variable');
      process.exit(1);
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Issuer Contract ID: ${contractId}`);
    console.log('');
    
    const client = new OcpClient();
    
    console.log('📝 Retrieving issuer as OCF object...');

    // Call the getIssuerAsOcf function
    const result = await client.issuer.getIssuerAsOcf({
      contractId: contractId
    });
    
    console.log('✅ Issuer retrieved successfully!');
    console.log('');
    console.log('📊 OCF Issuer Object:');
    console.log(JSON.stringify(result.issuer, null, 2));
    console.log('');
    console.log('🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Error occurred:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
