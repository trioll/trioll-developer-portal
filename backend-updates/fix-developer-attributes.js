// Fix developer attributes for freddiecaplin@hotmail.com

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_cLPH2acQd';

async function fixDeveloperAttributes() {
    console.log('🔧 Fixing developer attributes for freddiecaplin@hotmail.com...\n');
    
    try {
        // Find the correct user (lowercase email)
        const users = await cognito.listUsers({
            UserPoolId: USER_POOL_ID,
            Filter: 'email = "freddiecaplin@hotmail.com"'
        }).promise();
        
        if (users.Users.length === 0) {
            console.log('❌ User not found');
            return;
        }
        
        const user = users.Users[0];
        console.log('✅ Found user:', user.Username);
        console.log('   Email:', user.Attributes.find(a => a.Name === 'email')?.Value);
        console.log('   Sub:', user.Attributes.find(a => a.Name === 'sub')?.Value);
        
        // Current values
        const currentPrefUsername = user.Attributes.find(a => a.Name === 'preferred_username')?.Value;
        console.log('\n📋 Current attribute values:');
        console.log(`   preferred_username: ${currentPrefUsername || 'NOT SET'}`);
        
        // Update with correct values
        console.log('\n📝 Updating to correct values...');
        console.log('   preferred_username (developer_id): dev_c84a7e');
        console.log('   website (company_name): FreddieTrioll');
        console.log('   profile (user_type): developer');
        
        const updateParams = {
            UserPoolId: USER_POOL_ID,
            Username: user.Username,
            UserAttributes: [
                {
                    Name: 'preferred_username',
                    Value: 'dev_c84a7e'
                },
                {
                    Name: 'website', 
                    Value: 'FreddieTrioll'
                },
                {
                    Name: 'profile',
                    Value: 'developer'
                }
            ]
        };
        
        await cognito.adminUpdateUserAttributes(updateParams).promise();
        console.log('\n✅ Attributes updated successfully!');
        
        // Verify the update
        console.log('\n🔍 Verifying update...');
        const updatedUser = await cognito.adminGetUser({
            UserPoolId: USER_POOL_ID,
            Username: user.Username
        }).promise();
        
        console.log('Updated attributes:');
        updatedUser.UserAttributes.forEach(attr => {
            if (['preferred_username', 'website', 'profile'].includes(attr.Name)) {
                console.log(`   ${attr.Name}: ${attr.Value}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Execute
if (require.main === module) {
    fixDeveloperAttributes()
        .then(() => {
            console.log('\n🎉 Fix completed!');
            process.exit(0);
        })
        .catch(() => process.exit(1));
}