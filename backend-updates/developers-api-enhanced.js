const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';
const USER_POOL_ID = process.env.USER_POOL_ID;
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to generate developer ID with increment for similar emails
async function generateDeveloperId(email) {
    // Extract username from email
    const username = email.split('@')[0].toLowerCase();
    const baseId = username.substring(0, 6).padEnd(6, '0').replace(/[^a-z0-9]/g, '0');
    
    // Query for existing developer IDs with same base
    const queryParams = {
        TableName: USERS_TABLE,
        IndexName: 'developerIdIndex', // GSI on developerId field
        KeyConditionExpression: 'begins_with(developerId, :baseId)',
        ExpressionAttributeValues: {
            ':baseId': `dev_${baseId}`
        },
        ProjectionExpression: 'developerId'
    };
    
    try {
        const result = await dynamodb.query(queryParams).promise();
        
        if (!result.Items || result.Items.length === 0) {
            // First user with this base ID
            return `dev_${baseId}`;
        }
        
        // Find the highest number suffix
        let maxNumber = 0;
        const basePattern = `dev_${baseId}`;
        
        result.Items.forEach(item => {
            const id = item.developerId;
            if (id === basePattern) {
                // No number suffix
                maxNumber = Math.max(maxNumber, 0);
            } else if (id.startsWith(basePattern)) {
                // Extract number suffix
                const suffix = id.substring(basePattern.length);
                const num = parseInt(suffix);
                if (!isNaN(num)) {
                    maxNumber = Math.max(maxNumber, num);
                }
            }
        });
        
        // Return next available ID
        return maxNumber === 0 ? `${basePattern}1` : `${basePattern}${maxNumber + 1}`;
        
    } catch (error) {
        console.error('Error querying for existing developer IDs:', error);
        // Fallback: use timestamp to ensure uniqueness
        return `dev_${baseId}_${Date.now()}`;
    }
}

// Register new developer
exports.register = async (event) => {
    const { email, password, companyName } = JSON.parse(event.body);
    
    try {
        // First check if user already exists in DynamoDB
        const existingUser = await dynamodb.get({
            TableName: USERS_TABLE,
            Key: { email }
        }).promise();
        
        if (existingUser.Item) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'An account with this email already exists'
                })
            };
        }
        
        // Generate unique developer ID
        const developerId = await generateDeveloperId(email);
        console.log(`Generated developer ID: ${developerId} for email: ${email}`);
        
        // Create Cognito user
        const signUpParams = {
            ClientId: process.env.CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'preferred_username', Value: companyName || email.split('@')[0] }
            ]
        };
        
        const cognitoResult = await cognito.signUp(signUpParams).promise();
        
        // Save to DynamoDB with developer info
        const timestamp = new Date().toISOString();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await dynamodb.put({
            TableName: USERS_TABLE,
            Item: {
                email,
                userId: cognitoResult.UserSub,
                developerId,
                companyName: companyName || email.split('@')[0],
                password: hashedPassword,
                userType: 'developer',
                createdAt: timestamp,
                updatedAt: timestamp,
                joinDate: timestamp,
                verified: false
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Account created successfully. Please check your email to verify your account.',
                developerId,
                requiresVerification: true
            })
        };
        
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 'UsernameExistsException') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'An account with this email already exists'
                })
            };
        }
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to create account'
            })
        };
    }
};

// Login developer
exports.login = async (event) => {
    const { email, password } = JSON.parse(event.body);
    
    try {
        // Try to authenticate with Cognito
        const authParams = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };
        
        let cognitoResult;
        let autoConfirmed = false;
        
        try {
            cognitoResult = await cognito.initiateAuth(authParams).promise();
        } catch (authError) {
            if (authError.code === 'UserNotConfirmedException') {
                // Auto-confirm the user
                console.log('Auto-confirming unverified user:', email);
                await cognito.adminConfirmSignUp({
                    UserPoolId: USER_POOL_ID,
                    Username: email
                }).promise();
                
                autoConfirmed = true;
                cognitoResult = await cognito.initiateAuth(authParams).promise();
            } else {
                throw authError;
            }
        }
        
        // Get user data from DynamoDB
        const userData = await dynamodb.get({
            TableName: USERS_TABLE,
            Key: { email }
        }).promise();
        
        if (!userData.Item) {
            // User exists in Cognito but not DynamoDB - create DynamoDB entry
            const developerId = await generateDeveloperId(email);
            const timestamp = new Date().toISOString();
            
            await dynamodb.put({
                TableName: USERS_TABLE,
                Item: {
                    email,
                    developerId,
                    companyName: email.split('@')[0],
                    userType: 'developer',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    joinDate: timestamp,
                    verified: true
                }
            }).promise();
            
            userData.Item = {
                email,
                developerId,
                companyName: email.split('@')[0],
                joinDate: timestamp
            };
        }
        
        // Update verified status if auto-confirmed
        if (autoConfirmed && !userData.Item.verified) {
            await dynamodb.update({
                TableName: USERS_TABLE,
                Key: { email },
                UpdateExpression: 'SET verified = :true, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':true': true,
                    ':now': new Date().toISOString()
                }
            }).promise();
        }
        
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
                    email: userData.Item.email,
                    developerId: userData.Item.developerId,
                    companyName: userData.Item.companyName,
                    joinDate: userData.Item.joinDate || userData.Item.createdAt
                }
            })
        };
        
    } catch (error) {
        console.error('Login error:', error);
        
        let message = 'Invalid email or password';
        if (error.code === 'NotAuthorizedException') {
            message = 'Invalid email or password';
        } else if (error.code === 'UserNotFoundException') {
            message = 'No account found with this email';
        }
        
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message
            })
        };
    }
};

// Get developer profile
exports.getProfile = async (event) => {
    // Extract email from JWT token
    const token = event.headers.Authorization?.replace('Bearer ', '');
    if (!token) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'No authorization token provided'
            })
        };
    }
    
    try {
        // Decode JWT to get email
        const decoded = jwt.decode(token);
        const email = decoded.email || decoded['cognito:username'];
        
        if (!email) {
            throw new Error('No email in token');
        }
        
        // Get user data from DynamoDB
        const userData = await dynamodb.get({
            TableName: USERS_TABLE,
            Key: { email }
        }).promise();
        
        if (!userData.Item) {
            // Create profile if it doesn't exist
            const developerId = await generateDeveloperId(email);
            const timestamp = new Date().toISOString();
            const companyName = decoded.preferred_username || email.split('@')[0];
            
            await dynamodb.put({
                TableName: USERS_TABLE,
                Item: {
                    email,
                    developerId,
                    companyName,
                    userType: 'developer',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    joinDate: timestamp,
                    verified: true
                }
            }).promise();
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    developer: {
                        email,
                        developerId,
                        companyName,
                        joinDate: timestamp
                    }
                })
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                developer: {
                    email: userData.Item.email,
                    developerId: userData.Item.developerId,
                    companyName: userData.Item.companyName,
                    joinDate: userData.Item.joinDate || userData.Item.createdAt,
                    gamesCount: userData.Item.gamesCount || 0,
                    totalPlays: userData.Item.totalPlays || 0
                }
            })
        };
        
    } catch (error) {
        console.error('Get profile error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to get profile'
            })
        };
    }
};

// Lambda handler
exports.handler = async (event) => {
    const path = event.path;
    const method = event.httpMethod;
    
    console.log('Developers API request:', method, path);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }
    
    try {
        if (path === '/developers/register' && method === 'POST') {
            return await exports.register(event);
        } else if (path === '/developers/login' && method === 'POST') {
            return await exports.login(event);
        } else if (path === '/developers/profile' && method === 'GET') {
            return await exports.getProfile(event);
        } else {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Endpoint not found'
                })
            };
        }
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Internal server error'
            })
        };
    }
};