// Script to add custom attributes to Cognito User Pool
// Note: Custom attributes cannot be modified or deleted once created

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_cLPH2acQd';

async function addCustomAttributes() {
    console.log('🔧 Adding custom attributes to Cognito User Pool...');
    console.log('User Pool ID:', USER_POOL_ID);
    
    try {
        // First, get current user pool configuration
        console.log('\n📋 Fetching current user pool configuration...');
        const currentPool = await cognito.describeUserPool({
            UserPoolId: USER_POOL_ID
        }).promise();
        
        const existingAttributes = currentPool.UserPool.SchemaAttributes || [];
        console.log(`Found ${existingAttributes.length} existing attributes`);
        
        // Check if custom attributes already exist
        const existingCustomAttrs = existingAttributes.filter(attr => 
            attr.Name.startsWith('custom:')
        );
        
        if (existingCustomAttrs.length > 0) {
            console.log('\n⚠️  Found existing custom attributes:');
            existingCustomAttrs.forEach(attr => {
                console.log(`  - ${attr.Name}`);
            });
        }
        
        // Define new custom attributes
        const newAttributes = [
            {
                Name: 'developer_id',
                AttributeDataType: 'String',
                DeveloperOnlyAttribute: false,
                Mutable: true,
                Required: false,
                StringAttributeConstraints: {
                    MinLength: '1',
                    MaxLength: '50'
                }
            },
            {
                Name: 'company_name',
                AttributeDataType: 'String',
                DeveloperOnlyAttribute: false,
                Mutable: true,
                Required: false,
                StringAttributeConstraints: {
                    MinLength: '1',
                    MaxLength: '100'
                }
            },
            {
                Name: 'user_type',
                AttributeDataType: 'String',
                DeveloperOnlyAttribute: false,
                Mutable: true,
                Required: false,
                StringAttributeConstraints: {
                    MinLength: '1',
                    MaxLength: '20'
                }
            }
        ];
        
        // Check which attributes need to be added
        const attributesToAdd = newAttributes.filter(newAttr => {
            const exists = existingAttributes.some(existing => 
                existing.Name === `custom:${newAttr.Name}`
            );
            return !exists;
        });
        
        if (attributesToAdd.length === 0) {
            console.log('\n✅ All custom attributes already exist!');
            return;
        }
        
        console.log(`\n📝 Adding ${attributesToAdd.length} new custom attributes...`);
        
        // Add custom attributes to schema
        const schemaAttributes = [...existingAttributes];
        
        attributesToAdd.forEach(attr => {
            console.log(`  - Adding custom:${attr.Name}`);
            schemaAttributes.push({
                ...attr,
                Name: `custom:${attr.Name}` // Cognito automatically prefixes with 'custom:'
            });
        });
        
        // Update user pool schema
        console.log('\n🚀 Updating user pool schema...');
        await cognito.updateUserPool({
            UserPoolId: USER_POOL_ID,
            UserPoolAddOns: currentPool.UserPool.UserPoolAddOns,
            Policies: currentPool.UserPool.Policies,
            LambdaConfig: currentPool.UserPool.LambdaConfig,
            AutoVerifiedAttributes: currentPool.UserPool.AutoVerifiedAttributes,
            SmsVerificationMessage: currentPool.UserPool.SmsVerificationMessage,
            EmailVerificationMessage: currentPool.UserPool.EmailVerificationMessage,
            EmailVerificationSubject: currentPool.UserPool.EmailVerificationSubject,
            VerificationMessageTemplate: currentPool.UserPool.VerificationMessageTemplate,
            SmsAuthenticationMessage: currentPool.UserPool.SmsAuthenticationMessage,
            MfaConfiguration: currentPool.UserPool.MfaConfiguration,
            DeviceConfiguration: currentPool.UserPool.DeviceConfiguration,
            EmailConfiguration: currentPool.UserPool.EmailConfiguration,
            SmsConfiguration: currentPool.UserPool.SmsConfiguration,
            UserPoolTags: currentPool.UserPool.UserPoolTags,
            AdminCreateUserConfig: currentPool.UserPool.AdminCreateUserConfig
        }).promise();
        
        console.log('\n✅ Custom attributes added successfully!');
        
        // List all app clients
        console.log('\n📱 Fetching app clients...');
        const clientsResponse = await cognito.listUserPoolClients({
            UserPoolId: USER_POOL_ID,
            MaxResults: 60
        }).promise();
        
        console.log(`Found ${clientsResponse.UserPoolClients.length} app clients:`);
        clientsResponse.UserPoolClients.forEach(client => {
            console.log(`  - ${client.ClientName} (${client.ClientId})`);
        });
        
        console.log('\n✅ Custom attributes have been added to the user pool!');
        console.log('⚠️  Note: App client settings need to be updated separately to read/write these attributes');
        
    } catch (error) {
        console.error('\n❌ Error adding custom attributes:', error);
        if (error.code === 'InvalidParameterException') {
            console.error('This might mean the attributes already exist or there\'s a schema conflict');
        }
        throw error;
    }
}

// Execute the script
if (require.main === module) {
    addCustomAttributes()
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { addCustomAttributes };