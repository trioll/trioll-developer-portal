// Lambda function for Cognito Pre-Token Generation trigger
// This adds custom claims to JWT tokens including developer_id
// Simple version that only copies custom attributes to token claims

exports.handler = async (event) => {
    console.log('Pre-token generation trigger:', JSON.stringify(event, null, 2));
    
    // Extract user information
    const { request } = event;
    const { userAttributes } = request;
    const email = userAttributes.email;
    
    // Initialize response
    event.response = {
        claimsOverrideDetails: {
            claimsToAddOrOverride: {}
        }
    };
    
    // Check if developer_id exists in Cognito attributes
    if (userAttributes['custom:developer_id']) {
        console.log('Adding custom attributes to token for user:', email);
        console.log('Developer ID:', userAttributes['custom:developer_id']);
        
        // Add all custom attributes to token
        event.response.claimsOverrideDetails.claimsToAddOrOverride = {
            'custom:developer_id': userAttributes['custom:developer_id'],
            'custom:user_type': userAttributes['custom:user_type'] || 'developer',
            'custom:company_name': userAttributes['custom:company_name'] || email.split('@')[0]
        };
        
        console.log('Claims added to token:', event.response.claimsOverrideDetails.claimsToAddOrOverride);
    } else {
        console.log('No developer_id found in Cognito attributes for:', email);
        // Don't add any custom claims - user will need to be migrated
    }
    
    return event;
};