const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Quick fix - update the login handler to use Cognito properly
exports.handler = async (event) => {
    console.log('Login fix - using Cognito for authentication');
    
    const { email, password } = JSON.parse(event.body);
    const CLIENT_ID = '5joogquqr4jgukp7mncgp3g23h';
    const USER_POOL_ID = 'us-east-1_cLPH2acQd';
    
    try {
        // Authenticate with Cognito
        const authParams = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };
        
        let cognitoResult;
        
        try {
            cognitoResult = await cognito.initiateAuth(authParams).promise();
        } catch (authError) {
            if (authError.code === 'UserNotConfirmedException') {
                // Auto-confirm the user
                await cognito.adminConfirmSignUp({
                    UserPoolId: USER_POOL_ID,
                    Username: email
                }).promise();
                
                cognitoResult = await cognito.initiateAuth(authParams).promise();
            } else {
                throw authError;
            }
        }
        
        // Get user from DynamoDB
        const scanResult = await dynamodb.scan({
            TableName: 'trioll-prod-users',
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        }).promise();
        
        const userData = scanResult.Items[0];
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                tokens: {
                    idToken: cognitoResult.AuthenticationResult.IdToken,
                    accessToken: cognitoResult.AuthenticationResult.AccessToken,
                    refreshToken: cognitoResult.AuthenticationResult.RefreshToken
                },
                developer: {
                    email: userData.email,
                    developerId: userData.developerId,
                    companyName: userData.companyName || userData.displayName,
                    joinDate: userData.createdAt
                }
            })
        };
        
    } catch (error) {
        console.error('Login error:', error);
        
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: error.code === 'NotAuthorizedException' ? 'Invalid email or password' : error.message
            })
        };
    }
};