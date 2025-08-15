#!/usr/bin/env ts-node

import { OcpFactoryClient } from '../src';

async function main() {
  try {
    console.log('🚀 Starting createIssuer script...');
    
    // Get parameters from command line arguments or environment
    const contractId = process.argv[2] || process.env.ISSUER_AUTHORIZATION_CONTRACT_ID;
    const legalName = process.argv[3] || process.env.LEGAL_NAME;
    const countryOfFormation = process.argv[4] || process.env.COUNTRY_OF_FORMATION;
    const createdEventBlob = process.argv[5] || process.env.CREATED_EVENT_BLOB;
    const synchronizerId = process.argv[6] || process.env.SYNCHRONIZER_ID;
    
    if (!contractId || !legalName || !countryOfFormation || !createdEventBlob || !synchronizerId) {
      console.error('❌ Error: All required parameters are required');
      console.log('Usage: npm run script:create-issuer <contract-id> <legal-name> <country-of-formation> <created-event-blob> <synchronizer-id>');
      console.log('   or set environment variables:');
      console.log('   - ISSUER_AUTHORIZATION_CONTRACT_ID');
      console.log('   - LEGAL_NAME');
      console.log('   - COUNTRY_OF_FORMATION');
      console.log('   - CREATED_EVENT_BLOB');
      console.log('   - SYNCHRONIZER_ID');
      process.exit(1);
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Contract ID: ${contractId}`);
    console.log(`   Legal Name: ${legalName}`);
    console.log(`   Country of Formation: ${countryOfFormation}`);
    console.log(`   Created Event Blob: ${createdEventBlob.substring(0, 50)}...`);
    console.log(`   Synchronizer ID: ${synchronizerId}`);
    console.log('');
    
    const client = new OcpFactoryClient();
    
    console.log('📝 Creating issuer...');

    // Create issuer data
    const issuerData = {
      legal_name: legalName,
      formation_date: null, // DAML Date is a string in YYYY-MM-DD format
      country_of_formation: countryOfFormation,
      dba: null, // Optional
      country_subdivision_of_formation: null, // Optional
      tax_ids: null, // Empty array for now
      email: null, // Optional
      phone: null, // Optional
      address: null, // Optional
      initial_shares_authorized: null // DAML Numeric is a string
    };

    // Create issuer authorization contract details
    const issuerAuthorizationContractDetails = {
      contractId,
      createdEventBlob,
      synchronizerId
    };

    // Call the createIssuer function
    const result = await client.createIssuer({
      issuerAuthorizationContractDetails,
      issuerData
    });
    
    console.log('✅ Issuer created successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Issuer Contract ID: ${result.contractId}`);
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