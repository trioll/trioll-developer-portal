// Script to migrate existing users' developer IDs to Cognito custom attributes
// This ensures existing users get the custom claims in their tokens

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1'
});

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd';
const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';

async function migrateUserAttributes() {
    console.log('🚀 Starting user attribute migration...');
    console.log(`User Pool: ${USER_POOL_ID}`);
    console.log(`Users Table: ${USERS_TABLE}`);
    console.log('');
    
    try {
        // Scan all users with developer IDs from DynamoDB
        console.log('📋 Scanning DynamoDB for users with developer IDs...');
        const scanParams = {
            TableName: USERS_TABLE,
            FilterExpression: 'attribute_exists(developerId) AND attribute_exists(email)'
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        const users = scanResult.Items || [];
        
        console.log(`Found ${users.length} users with developer IDs`);
        console.log('');
        
        let successCount = 0;
        let failCount = 0;
        
        // Process each user
        for (const user of users) {
            try {
                console.log(`Processing: ${user.email}`);
                console.log(`  Developer ID: ${user.developerId}`);
                console.log(`  Company: ${user.companyName || 'Not set'}`);
                
                // First, check if user exists in Cognito
                let cognitoUsername = user.email;
                
                try {
                    // Try to get user by email
                    const getUserResult = await cognito.adminGetUser({
                        UserPoolId: USER_POOL_ID,
                        Username: user.email
                    }).promise();
                    
                    // User exists, get the actual username (might be different from email)
                    cognitoUsername = getUserResult.Username;
                    
                } catch (getUserError) {
                    if (getUserError.code === 'UserNotFoundException') {
                        console.log(`  ⚠️  User not found in Cognito, skipping...`);
                        continue;
                    }
                    throw getUserError;
                }
                
                // Update Cognito attributes
                const attributes = [
                    { Name: 'custom:developer_id', Value: user.developerId },
                    { Name: 'custom:user_type', Value: user.userType || 'developer' }
                ];
                
                if (user.companyName) {
                    attributes.push({ Name: 'custom:company_name', Value: user.companyName });
                }
                
                await cognito.adminUpdateUserAttributes({
                    UserPoolId: USER_POOL_ID,
                    Username: cognitoUsername,
                    UserAttributes: attributes
                }).promise();
                
                console.log(`  ✅ Successfully updated Cognito attributes`);
                successCount++;
                
            } catch (error) {
                console.error(`  ❌ Failed to update ${user.email}:`, error.message);
                if (error.code) {
                    console.error(`     Error code: ${error.code}`);
                }
                failCount++;
            }
            
            console.log('');
        }
        
        // Summary
        console.log('🏁 Migration Summary:');
        console.log(`✅ Successfully migrated: ${successCount} users`);
        console.log(`❌ Failed: ${failCount} users`);
        console.log(`📊 Total processed: ${users.length} users`);
        
        if (successCount > 0) {
            console.log('');
            console.log('🎉 Migration completed!');
            console.log('');
            console.log('Next steps:');
            console.log('1. Deploy the pre-token generation Lambda');
            console.log('2. Configure Cognito trigger');
            console.log('3. Users will get custom claims on next login');
        }
        
    } catch (error) {
        console.error('Fatal error during migration:', error);
        process.exit(1);
    }
}

// Check for specific user migration
if (process.argv[2] === '--user') {
    const email = process.argv[3];
    if (!email) {
        console.error('Usage: node migrate-user-attributes.js --user <email>');
        process.exit(1);
    }
    
    // Migrate single user
    migrateUserAttributes();
} else {
    // Migrate all users
    console.log('Migrating all users...');
    console.log('To migrate a single user: node migrate-user-attributes.js --user <email>');
    console.log('');
    migrateUserAttributes();
}