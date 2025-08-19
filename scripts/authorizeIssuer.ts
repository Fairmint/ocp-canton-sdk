#!/usr/bin/env ts-node

import { OcpClient } from '../src';

async function main() {
  try {
    console.log('🚀 Starting authorizeIssuer script...');
    
    // Get issuer party ID from command line arguments or environment
    const issuerPartyId = process.argv[2] || process.env.ISSUER_PARTY_ID;
    
    if (!issuerPartyId) {
      console.error('❌ Error: Issuer party ID is required');
      console.log('Usage: npm run script:authorize <issuer-party-id>');
      console.log('   or set ISSUER_PARTY_ID environment variable');
      process.exit(1);
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Issuer Party ID: ${issuerPartyId}`);
    console.log('');
    
    const client = new OcpClient();
    
    console.log('📝 Authorizing issuer...');

    // Call the authorizeIssuer function
    const result = await client.issuer.authorizeIssuer({
      issuer: issuerPartyId
    });
    
    console.log('✅ Issuer authorized successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   IssuerAuthorization Contract ID: ${result.contractId}`);
    console.log(`   Transaction ID: ${result.updateId}`);
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