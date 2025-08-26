#!/usr/bin/env ts-node

import { OcpClient } from '../src';
import { Fairmint } from '@fairmint/open-captable-protocol-daml-js';

async function main() {
  try {
    console.log('🚀 Starting createIssuer script...');
    
    // Get parameters from command line arguments or environment
    const issuerAuthContractId = process.argv[2] || process.env.ISSUER_AUTHORIZATION_CONTRACT_ID;
    const legalName = process.argv[3] || process.env.LEGAL_NAME;
    const countryOfFormation = process.argv[4] || process.env.COUNTRY_OF_FORMATION;
    const issuerAuthCreatedEventBlob = process.argv[5] || process.env.ISSUER_AUTH_CREATED_EVENT_BLOB;
    const issuerAuthSynchronizerId = process.argv[6] || process.env.ISSUER_AUTH_SYNCHRONIZER_ID;
    const issuerPartyId = process.argv[7] || process.env.ISSUER_PARTY_ID;
    const featuredAppRightContractId = process.argv[8] || process.env.FEATURED_APP_RIGHT_CONTRACT_ID;
    const featuredAppRightCreatedEventBlob = process.argv[9] || process.env.FEATURED_APP_RIGHT_CREATED_EVENT_BLOB;
    const featuredAppRightSynchronizerId = process.argv[10] || process.env.FEATURED_APP_RIGHT_SYNCHRONIZER_ID;
    const featuredAppRightTemplateId = process.argv[11] || process.env.FEATURED_APP_RIGHT_TEMPLATE_ID;
    
    if (!issuerAuthContractId || !legalName || !countryOfFormation || !issuerAuthCreatedEventBlob || 
        !issuerAuthSynchronizerId || !issuerPartyId || !featuredAppRightContractId || 
        !featuredAppRightCreatedEventBlob || !featuredAppRightSynchronizerId || !featuredAppRightTemplateId) {
      console.error('❌ Error: All required parameters are required');
      console.log('Usage: npm run script:create-issuer <issuer-auth-contract-id> <legal-name> <country-of-formation> <issuer-auth-created-event-blob> <issuer-auth-synchronizer-id> <issuer-party-id> <featured-app-right-contract-id> <featured-app-right-created-event-blob> <featured-app-right-synchronizer-id> <featured-app-right-template-id>');
      console.log('   or set environment variables:');
      console.log('   - ISSUER_AUTHORIZATION_CONTRACT_ID');
      console.log('   - LEGAL_NAME');
      console.log('   - COUNTRY_OF_FORMATION');
      console.log('   - ISSUER_AUTH_CREATED_EVENT_BLOB');
      console.log('   - ISSUER_AUTH_SYNCHRONIZER_ID');
      console.log('   - ISSUER_PARTY_ID');
      console.log('   - FEATURED_APP_RIGHT_CONTRACT_ID');
      console.log('   - FEATURED_APP_RIGHT_CREATED_EVENT_BLOB');
      console.log('   - FEATURED_APP_RIGHT_SYNCHRONIZER_ID');
      console.log('   - FEATURED_APP_RIGHT_TEMPLATE_ID');
      process.exit(1);
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Issuer Auth Contract ID: ${issuerAuthContractId}`);
    console.log(`   Legal Name: ${legalName}`);
    console.log(`   Country of Formation: ${countryOfFormation}`);
    console.log(`   Issuer Auth Created Event Blob: ${issuerAuthCreatedEventBlob.substring(0, 50)}...`);
    console.log(`   Issuer Auth Synchronizer ID: ${issuerAuthSynchronizerId}`);
    console.log(`   Issuer Party ID: ${issuerPartyId}`);
    console.log(`   Featured App Right Contract ID: ${featuredAppRightContractId}`);
    console.log(`   Featured App Right Created Event Blob: ${featuredAppRightCreatedEventBlob.substring(0, 50)}...`);
    console.log(`   Featured App Right Synchronizer ID: ${featuredAppRightSynchronizerId}`);
    console.log(`   Featured App Right Template ID: ${featuredAppRightTemplateId}`);
    console.log('');
    
    const client = new OcpClient();
    
    console.log('📝 Creating issuer...');

    // Create issuer data
    const issuerData = {
      legal_name: legalName,
      formation_date: null, // DAML Date is a string in YYYY-MM-DD format
      country_of_formation: countryOfFormation,
      dba: null, // Optional
      country_subdivision_of_formation: null, // Optional
      tax_ids: null, // Empty array for now
      email: null, // Optional - can be set to: { email_type: 'OcfEmailTypeBusiness', email_address: 'contact@company.com' }
      phone: null, // Optional
      address: null, // Optional
      initial_shares_authorized: null // DAML Numeric is a string
    };

    // Create issuer authorization contract details
    const issuerAuthorizationContractDetails = {
      contractId: issuerAuthContractId,
      createdEventBlob: issuerAuthCreatedEventBlob,
      synchronizerId: issuerAuthSynchronizerId,
      templateId: Fairmint.OpenCapTable.IssuerAuthorization.IssuerAuthorization.templateId
    };

    // Create featured app right contract details
    const featuredAppRightContractDetails = {
      contractId: featuredAppRightContractId,
      createdEventBlob: featuredAppRightCreatedEventBlob,
      synchronizerId: featuredAppRightSynchronizerId,
      templateId: featuredAppRightTemplateId
    };

    // Call the createIssuer function
    const result = await client.issuer.createIssuer({
      issuerAuthorizationContractDetails,
      featuredAppRightContractDetails,
      issuerParty: issuerPartyId,
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