// Script to update Cognito App Clients to handle developer attributes
// Since we can't add custom attributes to existing pool, we'll use standard attributes creatively

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const DEVELOPER_CLIENT_ID = '5joogquqr4jgukp7mncgp3g23h';
const MOBILE_CLIENT_ID = 'bft50gui77sdq2n4lcio4onql';

async function updateAppClients() {
    console.log('🔧 Updating Cognito App Clients for developer attributes...');
    console.log('User Pool ID:', USER_POOL_ID);
    
    try {
        // Update Developer Portal Client
        console.log('\n📱 Updating Developer Portal App Client...');
        const devClient = await cognito.describeUserPoolClient({
            UserPoolId: USER_POOL_ID,
            ClientId: DEVELOPER_CLIENT_ID
        }).promise();
        
        console.log(`  - Client Name: ${devClient.UserPoolClient.ClientName}`);
        
        // We'll use standard attributes creatively:
        // - preferred_username: for developer_id
        // - website: for company_name  
        // - profile: for user_type
        
        const readAttributes = [
            'email',
            'email_verified',
            'preferred_username',  // Will store developer_id
            'website',            // Will store company_name
            'profile',           // Will store user_type
            'sub',
            'updated_at'
        ];
        
        const writeAttributes = [
            'email',
            'preferred_username',
            'website',
            'profile'
        ];
        
        await cognito.updateUserPoolClient({
            UserPoolId: USER_POOL_ID,
            ClientId: DEVELOPER_CLIENT_ID,
            ClientName: devClient.UserPoolClient.ClientName,
            RefreshTokenValidity: devClient.UserPoolClient.RefreshTokenValidity,
            ExplicitAuthFlows: devClient.UserPoolClient.ExplicitAuthFlows,
            SupportedIdentityProviders: devClient.UserPoolClient.SupportedIdentityProviders,
            CallbackURLs: devClient.UserPoolClient.CallbackURLs,
            LogoutURLs: devClient.UserPoolClient.LogoutURLs,
            DefaultRedirectURI: devClient.UserPoolClient.DefaultRedirectURI,
            AllowedOAuthFlows: devClient.UserPoolClient.AllowedOAuthFlows,
            AllowedOAuthScopes: devClient.UserPoolClient.AllowedOAuthScopes,
            AllowedOAuthFlowsUserPoolClient: devClient.UserPoolClient.AllowedOAuthFlowsUserPoolClient,
            AnalyticsConfiguration: devClient.UserPoolClient.AnalyticsConfiguration,
            PreventUserExistenceErrors: devClient.UserPoolClient.PreventUserExistenceErrors,
            ReadAttributes: readAttributes,
            WriteAttributes: writeAttributes
        }).promise();
        
        console.log('✅ Developer Portal Client updated');
        
        // Update Mobile App Client
        console.log('\n📱 Updating Mobile App Client...');
        const mobileClient = await cognito.describeUserPoolClient({
            UserPoolId: USER_POOL_ID,
            ClientId: MOBILE_CLIENT_ID
        }).promise();
        
        console.log(`  - Client Name: ${mobileClient.UserPoolClient.ClientName}`);
        
        await cognito.updateUserPoolClient({
            UserPoolId: USER_POOL_ID,
            ClientId: MOBILE_CLIENT_ID,
            ClientName: mobileClient.UserPoolClient.ClientName,
            RefreshTokenValidity: mobileClient.UserPoolClient.RefreshTokenValidity,
            ExplicitAuthFlows: mobileClient.UserPoolClient.ExplicitAuthFlows,
            SupportedIdentityProviders: mobileClient.UserPoolClient.SupportedIdentityProviders,
            CallbackURLs: mobileClient.UserPoolClient.CallbackURLs,
            LogoutURLs: mobileClient.UserPoolClient.LogoutURLs,
            DefaultRedirectURI: mobileClient.UserPoolClient.DefaultRedirectURI,
            AllowedOAuthFlows: mobileClient.UserPoolClient.AllowedOAuthFlows,
            AllowedOAuthScopes: mobileClient.UserPoolClient.AllowedOAuthScopes,
            AllowedOAuthFlowsUserPoolClient: mobileClient.UserPoolClient.AllowedOAuthFlowsUserPoolClient,
            AnalyticsConfiguration: mobileClient.UserPoolClient.AnalyticsConfiguration,
            PreventUserExistenceErrors: mobileClient.UserPoolClient.PreventUserExistenceErrors,
            ReadAttributes: readAttributes,  // Same attributes for consistency
            WriteAttributes: [] // Mobile app shouldn't write these attributes
        }).promise();
        
        console.log('✅ Mobile App Client updated');
        
        console.log('\n📋 Attribute Mapping:');
        console.log('  - preferred_username → developer_id');
        console.log('  - website → company_name');
        console.log('  - profile → user_type');
        
        console.log('\n✅ Both app clients have been updated!');
        
    } catch (error) {
        console.error('\n❌ Error updating app clients:', error);
        throw error;
    }
}

// Execute the script
if (require.main === module) {
    updateAppClients()
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { updateAppClients };