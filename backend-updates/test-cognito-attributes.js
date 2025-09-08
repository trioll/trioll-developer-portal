// Test script to verify Cognito attributes and token contents

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const CLIENT_ID = '5joogquqr4jgukp7mncgp3g23h';

async function testCognitoAttributes() {
    console.log('🧪 Testing Cognito Attributes and Authentication...\n');
    
    try {
        // Test 1: Check current user attributes
        console.log('📋 TEST 1: Checking freddiecaplin@hotmail.com attributes...');
        const users = await cognito.listUsers({
            UserPoolId: USER_POOL_ID,
            Filter: 'email = "freddiecaplin@hotmail.com"'
        }).promise();
        
        if (users.Users.length > 0) {
            const user = users.Users[0];
            console.log('✅ User found:', user.Username);
            console.log('\nCurrent attributes:');
            user.Attributes.forEach(attr => {
                console.log(`  ${attr.Name}: ${attr.Value}`);
            });
            
            // Check our mapped attributes
            const prefUsername = user.Attributes.find(a => a.Name === 'preferred_username')?.Value;
            const website = user.Attributes.find(a => a.Name === 'website')?.Value;
            const profile = user.Attributes.find(a => a.Name === 'profile')?.Value;
            
            console.log('\n🔍 Developer attribute mapping:');
            console.log(`  preferred_username (developer_id): ${prefUsername || 'NOT SET'}`);
            console.log(`  website (company_name): ${website || 'NOT SET'}`);
            console.log(`  profile (user_type): ${profile || 'NOT SET'}`);
            
            if (prefUsername !== 'dev_c84a7e') {
                console.log('\n⚠️  WARNING: preferred_username should be "dev_c84a7e" but is "' + prefUsername + '"');
            }
        } else {
            console.log('❌ User not found');
        }
        
        // Test 2: Simulate authentication to see token contents
        console.log('\n\n📋 TEST 2: Simulating authentication flow...');
        console.log('We need to update the user attributes first, then test login');
        console.log('Run fix-developer-attributes.js next to correct the mapping');
        
        // Test 3: Check app client configuration
        console.log('\n\n📋 TEST 3: Verifying app client can read attributes...');
        const clientInfo = await cognito.describeUserPoolClient({
            UserPoolId: USER_POOL_ID,
            ClientId: CLIENT_ID
        }).promise();
        
        console.log('App Client: ' + clientInfo.UserPoolClient.ClientName);
        console.log('\nReadable attributes:');
        const readAttrs = clientInfo.UserPoolClient.ReadAttributes || [];
        readAttrs.forEach(attr => {
            if (['preferred_username', 'website', 'profile'].includes(attr)) {
                console.log(`  ✅ ${attr}`);
            }
        });
        
        console.log('\n✅ Tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Execute
if (require.main === module) {
    testCognitoAttributes()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { testCognitoAttributes };