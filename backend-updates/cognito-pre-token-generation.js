// Lambda function for Cognito Pre-Token Generation trigger
// This adds custom claims to JWT tokens including developer_id

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';

exports.handler = async (event) => {
    console.log('Pre-token generation trigger:', JSON.stringify(event, null, 2));
    
    // Extract user information
    const { userPoolId, userName, request, triggerSource } = event;
    const { userAttributes } = request;
    const userId = userAttributes.sub;
    const email = userAttributes.email;
    
    // Initialize response
    event.response = {
        claimsOverrideDetails: {
            claimsToAddOrOverride: {}
        }
    };
    
    // Check if developer_id already exists in Cognito attributes
    if (userAttributes['custom:developer_id']) {
        console.log('Developer ID already in Cognito attributes:', userAttributes['custom:developer_id']);
        
        // Add all custom attributes to token
        event.response.claimsOverrideDetails.claimsToAddOrOverride = {
            'custom:developer_id': userAttributes['custom:developer_id'],
            'custom:user_type': userAttributes['custom:user_type'] || 'developer',
            'custom:company_name': userAttributes['custom:company_name'] || email.split('@')[0]
        };
        
        return event;
    }
    
    // Developer ID not in Cognito, look it up from DynamoDB
    console.log('Looking up developer ID for user:', userId);
    
    try {
        // Query users table (handles composite key)
        const queryParams = {
            TableName: USERS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 1
        };
        
        const queryResult = await dynamodb.query(queryParams).promise();
        
        if (queryResult.Items && queryResult.Items.length > 0) {
            const user = queryResult.Items[0];
            console.log('Found user in database:', user.email, 'Developer ID:', user.developerId);
            
            if (user.developerId) {
                // Add claims to token
                event.response.claimsOverrideDetails.claimsToAddOrOverride = {
                    'custom:developer_id': user.developerId,
                    'custom:user_type': user.userType || 'developer',
                    'custom:company_name': user.companyName || email.split('@')[0]
                };
                
                // Update Cognito attributes for future tokens
                // This makes subsequent logins faster
                const cognito = new AWS.CognitoIdentityServiceProvider();
                
                try {
                    await cognito.adminUpdateUserAttributes({
                        UserPoolId: userPoolId,
                        Username: userName,
                        UserAttributes: [
                            { Name: 'custom:developer_id', Value: user.developerId },
                            { Name: 'custom:user_type', Value: user.userType || 'developer' },
                            { Name: 'custom:company_name', Value: user.companyName || email.split('@')[0] }
                        ]
                    }).promise();
                    
                    console.log('Successfully updated Cognito attributes for user:', userName);
                } catch (updateError) {
                    // Log error but don't fail - token claims are already set
                    console.error('Failed to update Cognito attributes (non-fatal):', updateError.message);
                }
            } else {
                console.log('User found but no developerId assigned');
            }
        } else {
            // User not found by userId, try email lookup
            console.log('User not found by userId, trying email lookup:', email);
            
            const scanParams = {
                TableName: USERS_TABLE,
                FilterExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': email
                }
            };
            
            const scanResult = await dynamodb.scan(scanParams).promise();
            
            if (scanResult.Items && scanResult.Items.length > 0) {
                const user = scanResult.Items[0];
                console.log('Found user by email:', user.email, 'Developer ID:', user.developerId);
                
                if (user.developerId) {
                    // Add claims to token
                    event.response.claimsOverrideDetails.claimsToAddOrOverride = {
                        'custom:developer_id': user.developerId,
                        'custom:user_type': user.userType || 'developer',
                        'custom:company_name': user.companyName || email.split('@')[0]
                    };
                }
            } else {
                console.log('User not found in database');
            }
        }
    } catch (error) {
        console.error('Error looking up developer_id:', error);
        // Don't fail authentication - continue without custom claims
        // The API can still fall back to database lookups
    }
    
    // Log final claims being added
    console.log('Final claims to add:', event.response.claimsOverrideDetails.claimsToAddOrOverride);
    
    return event;
};