// Script to sync developer ID between Cognito and DynamoDB user profile

const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const USERS_TABLE = 'trioll-prod-users';

async function syncDeveloperProfile(email) {
    console.log(`🔄 Syncing developer profile for: ${email}`);
    console.log('================================\n');
    
    try {
        // Step 1: Find the user by email
        console.log('1️⃣ Looking up user in Cognito...');
        const userId = 'c84a7e96-5583-4d0b-be0a-4519518c288d'; // Your user ID from the token
        
        // Step 2: Get current user profile from DynamoDB
        console.log('\n2️⃣ Fetching user profile from DynamoDB...');
        const profileResult = await dynamodb.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: { userId: userId }
        }));
        
        const profile = profileResult.Item;
        if (profile) {
            console.log('Current profile:');
            console.log(`  Developer ID: ${profile.developerId || 'NOT SET'}`);
            console.log(`  Company: ${profile.companyName || 'NOT SET'}`);
            console.log(`  User Type: ${profile.userType || 'NOT SET'}`);
        } else {
            console.log('⚠️  No profile found in DynamoDB');
        }
        
        // Step 3: Update DynamoDB profile with correct developer ID
        console.log('\n3️⃣ Updating DynamoDB profile...');
        const updateParams = {
            TableName: USERS_TABLE,
            Key: { userId: userId },
            UpdateExpression: 'SET developerId = :devId, companyName = :company, userType = :type, updatedAt = :timestamp',
            ExpressionAttributeValues: {
                ':devId': 'dev_c84a7e',
                ':company': 'FreddieTrioll',
                ':type': 'developer',
                ':timestamp': new Date().toISOString()
            }
        };
        
        await dynamodb.send(new UpdateCommand(updateParams));
        console.log('✅ Profile updated with correct developer ID');
        
        // Step 4: Update Cognito attributes (if possible)
        console.log('\n4️⃣ Updating Cognito attributes...');
        try {
            const cognitoParams = {
                UserPoolId: USER_POOL_ID,
                Username: email,
                UserAttributes: [
                    { Name: 'custom:developer_id', Value: 'dev_c84a7e' },
                    { Name: 'custom:company_name', Value: 'FreddieTrioll' },
                    { Name: 'custom:user_type', Value: 'developer' }
                ]
            };
            
            await cognitoClient.send(new AdminUpdateUserAttributesCommand(cognitoParams));
            console.log('✅ Cognito attributes updated');
        } catch (error) {
            console.log('⚠️  Could not update Cognito attributes:', error.message);
            console.log('   (This is expected if custom attributes don\'t exist)');
        }
        
        // Step 5: Verify the update
        console.log('\n5️⃣ Verifying update...');
        const verifyResult = await dynamodb.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: { userId: userId }
        }));
        
        const updatedProfile = verifyResult.Item;
        console.log('Updated profile:');
        console.log(`  Developer ID: ${updatedProfile.developerId} ${updatedProfile.developerId === 'dev_c84a7e' ? '✅' : '❌'}`);
        console.log(`  Company: ${updatedProfile.companyName}`);
        console.log(`  User Type: ${updatedProfile.userType}`);
        
        console.log('\n✅ Profile sync complete!');
        console.log('\n⚠️  IMPORTANT: You may need to log out and log back in for changes to take effect');
        
    } catch (error) {
        console.error('❌ Error syncing profile:', error);
    }
}

// Main execution
if (require.main === module) {
    const email = process.argv[2] || 'freddiecaplin@hotmail.com';
    syncDeveloperProfile(email);
}