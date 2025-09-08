// Script to migrate existing users to have developer attributes in Cognito
// Uses standard attributes: preferred_username, website, profile

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const USERS_TABLE = 'trioll-prod-users';

async function migrateUserAttributes() {
    console.log('🔄 Migrating existing users with developer attributes...');
    
    try {
        // Step 1: List all Cognito users
        console.log('\n📋 Fetching Cognito users...');
        const cognitoUsers = [];
        let paginationToken = null;
        
        do {
            const params = {
                UserPoolId: USER_POOL_ID,
                Limit: 60
            };
            if (paginationToken) {
                params.PaginationToken = paginationToken;
            }
            
            const response = await cognito.listUsers(params).promise();
            cognitoUsers.push(...response.Users);
            paginationToken = response.PaginationToken;
        } while (paginationToken);
        
        console.log(`Found ${cognitoUsers.length} users in Cognito`);
        
        // Step 2: Process each user
        for (const cognitoUser of cognitoUsers) {
            const username = cognitoUser.Username;
            const userId = cognitoUser.Attributes.find(attr => attr.Name === 'sub')?.Value;
            const email = cognitoUser.Attributes.find(attr => attr.Name === 'email')?.Value;
            
            console.log(`\n👤 Processing user: ${email || username}`);
            console.log(`  - User ID: ${userId}`);
            
            // Check if user already has developer attributes
            const hasDevAttributes = cognitoUser.Attributes.some(attr => 
                attr.Name === 'preferred_username' || 
                attr.Name === 'website' || 
                attr.Name === 'profile'
            );
            
            if (hasDevAttributes) {
                console.log('  ✅ User already has developer attributes');
                const prefUsername = cognitoUser.Attributes.find(attr => attr.Name === 'preferred_username')?.Value;
                const website = cognitoUser.Attributes.find(attr => attr.Name === 'website')?.Value;
                const profile = cognitoUser.Attributes.find(attr => attr.Name === 'profile')?.Value;
                console.log(`     - preferred_username (developer_id): ${prefUsername || 'Not set'}`);
                console.log(`     - website (company_name): ${website || 'Not set'}`);
                console.log(`     - profile (user_type): ${profile || 'Not set'}`);
                continue;
            }
            
            // Step 3: Fetch developer info from DynamoDB
            let developerInfo = null;
            
            // Try to find by userId first
            if (userId) {
                try {
                    const result = await dynamodb.get({
                        TableName: USERS_TABLE,
                        Key: { userId }
                    }).promise();
                    
                    if (result.Item) {
                        developerInfo = result.Item;
                        console.log('  ✅ Found user in DynamoDB by userId');
                    }
                } catch (err) {
                    console.log('  ⚠️  userId lookup failed:', err.message);
                }
            }
            
            // Try by email if not found
            if (!developerInfo && email) {
                try {
                    const result = await dynamodb.get({
                        TableName: USERS_TABLE,
                        Key: { email }
                    }).promise();
                    
                    if (result.Item) {
                        developerInfo = result.Item;
                        console.log('  ✅ Found user in DynamoDB by email');
                    }
                } catch (err) {
                    console.log('  ⚠️  Email lookup failed:', err.message);
                }
            }
            
            // Special case for freddiecaplin@hotmail.com
            if (email === 'freddiecaplin@hotmail.com' && !developerInfo) {
                developerInfo = {
                    developerId: 'dev_c84a7e',
                    companyName: 'FreddieTrioll',
                    userType: 'developer'
                };
                console.log('  ✅ Applied special case for freddiecaplin@hotmail.com');
            }
            
            if (!developerInfo) {
                console.log('  ⚠️  No developer info found in DynamoDB, skipping');
                continue;
            }
            
            // Step 4: Update Cognito attributes
            console.log('  📝 Updating Cognito attributes...');
            console.log(`     - developer_id: ${developerInfo.developerId}`);
            console.log(`     - company_name: ${developerInfo.companyName}`);
            console.log(`     - user_type: ${developerInfo.userType || 'developer'}`);
            
            const updateParams = {
                UserPoolId: USER_POOL_ID,
                Username: username,
                UserAttributes: []
            };
            
            // Add attributes only if they exist
            if (developerInfo.developerId) {
                updateParams.UserAttributes.push({
                    Name: 'preferred_username',
                    Value: developerInfo.developerId
                });
            }
            
            if (developerInfo.companyName) {
                updateParams.UserAttributes.push({
                    Name: 'website',
                    Value: developerInfo.companyName
                });
            }
            
            updateParams.UserAttributes.push({
                Name: 'profile',
                Value: developerInfo.userType || 'developer'
            });
            
            try {
                await cognito.adminUpdateUserAttributes(updateParams).promise();
                console.log('  ✅ Cognito attributes updated successfully!');
            } catch (updateErr) {
                console.error('  ❌ Failed to update attributes:', updateErr.message);
            }
        }
        
        console.log('\n✅ User migration completed!');
        
        // Step 5: Verify migration
        console.log('\n🔍 Verifying migration...');
        const verifyUser = cognitoUsers.find(u => 
            u.Attributes.find(a => a.Name === 'email')?.Value === 'freddiecaplin@hotmail.com'
        );
        
        if (verifyUser) {
            console.log('Checking freddiecaplin@hotmail.com...');
            const verifyResponse = await cognito.adminGetUser({
                UserPoolId: USER_POOL_ID,
                Username: verifyUser.Username
            }).promise();
            
            console.log('Current attributes:');
            verifyResponse.UserAttributes.forEach(attr => {
                if (['preferred_username', 'website', 'profile'].includes(attr.Name)) {
                    console.log(`  - ${attr.Name}: ${attr.Value}`);
                }
            });
        }
        
    } catch (error) {
        console.error('\n❌ Migration error:', error);
        throw error;
    }
}

// Execute the script
if (require.main === module) {
    migrateUserAttributes()
        .then(() => {
            console.log('\n🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = { migrateUserAttributes };