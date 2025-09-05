const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';
const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd';
const JWT_SECRET = process.env.JWT_SECRET;

// Support both mobile app and developer portal client IDs
const MOBILE_CLIENT_ID = process.env.CLIENT_ID || 'bft50gui77sdq2n4lcio4onql';
const DEVELOPER_CLIENT_ID = process.env.DEVELOPER_CLIENT_ID || '5joogquqr4jgukp7mncgp3g23h';

// Helper function to determine which client ID to use
function getClientId(headers) {
    const appClient = headers['X-App-Client'] || headers['x-app-client'];
    if (appClient === 'developer-portal') {
        console.log('Using developer portal client ID:', DEVELOPER_CLIENT_ID);
        return DEVELOPER_CLIENT_ID;
    }
    console.log('Using mobile app client ID:', MOBILE_CLIENT_ID);
    return MOBILE_CLIENT_ID;
}

// Helper function to generate developer ID with increment for similar emails
async function generateDeveloperId(email) {
    const username = email.split('@')[0].toLowerCase();
    const baseId = username.substring(0, 6).padEnd(6, '0').replace(/[^a-z0-9]/g, '0');
    
    // Check for existing developer IDs
    try {
        const scanParams = {
            TableName: USERS_TABLE,
            FilterExpression: 'begins_with(developerId, :baseId)',
            ExpressionAttributeValues: {
                ':baseId': `dev_${baseId}`
            },
            ProjectionExpression: 'developerId'
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        
        if (!result.Items || result.Items.length === 0) {
            return `dev_${baseId}`;
        }
        
        // Find highest number suffix
        let maxNumber = 0;
        const basePattern = `dev_${baseId}`;
        
        result.Items.forEach(item => {
            const id = item.developerId;
            if (id === basePattern) {
                maxNumber = Math.max(maxNumber, 0);
            } else if (id.startsWith(basePattern)) {
                const suffix = id.substring(basePattern.length);
                const num = parseInt(suffix);
                if (!isNaN(num)) {
                    maxNumber = Math.max(maxNumber, num);
                }
            }
        });
        
        return maxNumber === 0 ? `${basePattern}1` : `${basePattern}${maxNumber + 1}`;
        
    } catch (error) {
        console.error('Error generating developer ID:', error);
        // Fallback to timestamp-based ID
        return `dev_${baseId}_${Date.now()}`;
    }
}

// Unified function to find user by email or userId
async function findUserByToken(token) {
    try {
        // Decode the JWT token
        const decoded = jwt.decode(token);
        if (!decoded) {
            console.error('Failed to decode token');
            return null;
        }
        
        console.log('Decoded token:', JSON.stringify(decoded, null, 2));
        
        // Extract possible identifiers
        const email = decoded.email || decoded['cognito:username'];
        const userId = decoded.sub;
        
        // First try to find by userId (newer schema)
        if (userId) {
            console.log('Trying to find user by userId:', userId);
            try {
                const result = await dynamodb.get({
                    TableName: USERS_TABLE,
                    Key: { userId }
                }).promise();
                
                if (result.Item) {
                    console.log('Found user by userId');
                    return result.Item;
                }
            } catch (error) {
                console.log('userId lookup failed:', error.message);
            }
        }
        
        // Then try by email (older schema)
        if (email) {
            console.log('Trying to find user by email:', email);
            try {
                const result = await dynamodb.get({
                    TableName: USERS_TABLE,
                    Key: { email }
                }).promise();
                
                if (result.Item) {
                    console.log('Found user by email');
                    return result.Item;
                }
            } catch (error) {
                console.log('Email lookup failed:', error.message);
            }
        }
        
        // If not found by direct lookup, try scanning (slower but comprehensive)
        console.log('Direct lookups failed, scanning table...');
        const scanParams = {
            TableName: USERS_TABLE,
            FilterExpression: 'email = :email OR userId = :userId',
            ExpressionAttributeValues: {
                ':email': email || 'none',
                ':userId': userId || 'none'
            }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        if (scanResult.Items && scanResult.Items.length > 0) {
            console.log('Found user by scan');
            return scanResult.Items[0];
        }
        
        console.log('User not found in database');
        return null;
        
    } catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
}

// Get developer profile
exports.getProfile = async (event) => {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
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
        // Find user using unified lookup
        let userData = await findUserByToken(token);
        
        // If user doesn't exist, create a new profile
        if (!userData) {
            console.log('User not found, creating new profile...');
            
            const decoded = jwt.decode(token);
            const email = decoded.email || decoded['cognito:username'];
            const userId = decoded.sub;
            
            if (!email || !userId) {
                throw new Error('Cannot extract user info from token');
            }
            
            const developerId = await generateDeveloperId(email);
            const timestamp = new Date().toISOString();
            const companyName = decoded.preferred_username || email.split('@')[0];
            
            // Create user with both email and userId for compatibility
            const newUser = {
                email,
                userId,
                developerId,
                companyName,
                userType: 'developer',
                createdAt: timestamp,
                updatedAt: timestamp,
                joinDate: timestamp,
                verified: true,
                gamesCount: 0,
                totalPlays: 0
            };
            
            // Try to save with userId as key first (newer schema)
            try {
                await dynamodb.put({
                    TableName: USERS_TABLE,
                    Item: { ...newUser, userId }
                }).promise();
                console.log('Created user with userId as key');
            } catch (error) {
                console.log('Failed to create with userId, trying email:', error.message);
                // Fallback to email as key (older schema)
                await dynamodb.put({
                    TableName: USERS_TABLE,
                    Item: { ...newUser, email }
                }).promise();
                console.log('Created user with email as key');
            }
            
            userData = newUser;
        }
        
        // Return the developer profile
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                developer: {
                    email: userData.email,
                    developerId: userData.developerId,
                    companyName: userData.companyName,
                    joinDate: userData.joinDate || userData.createdAt,
                    gamesCount: userData.gamesCount || 0,
                    totalPlays: userData.totalPlays || 0,
                    verified: userData.verified !== false
                }
            })
        };
        
    } catch (error) {
        console.error('Get profile error:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to get developer profile',
                error: error.message
            })
        };
    }
};

// Developer login - MODIFIED TO USE DYNAMIC CLIENT ID
exports.login = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (parseError) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Invalid JSON in request body'
            })
        };
    }
    
    const { email, password } = body;
    const headers = event.headers || {};
    
    if (!email || !password) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Email and password are required'
            })
        };
    }
    
    try {
        // Determine which client ID to use based on the X-App-Client header
        const clientId = getClientId(headers);
        
        // Authenticate with Cognito
        const authParams = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,  // Use the dynamically determined client ID
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
                console.log('Auto-confirming user:', email);
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
        
        // Get or create user profile
        const idToken = cognitoResult.AuthenticationResult.IdToken;
        let userData = await findUserByToken(idToken);
        
        if (!userData) {
            // Create new developer profile
            const decoded = jwt.decode(idToken);
            const userId = decoded.sub;
            const developerId = await generateDeveloperId(email);
            const timestamp = new Date().toISOString();
            
            // Determine user type based on client
            const userType = getClientId(headers) === DEVELOPER_CLIENT_ID ? 'developer' : 'consumer';
            
            userData = {
                email,
                userId,
                developerId: userType === 'developer' ? developerId : undefined,
                companyName: userType === 'developer' ? email.split('@')[0] : undefined,
                username: userType === 'consumer' ? email.split('@')[0] : undefined,
                userType,
                createdAt: timestamp,
                updatedAt: timestamp,
                joinDate: timestamp,
                verified: true
            };
            
            // Save with appropriate key
            try {
                await dynamodb.put({
                    TableName: USERS_TABLE,
                    Item: { ...userData, userId }
                }).promise();
            } catch (error) {
                await dynamodb.put({
                    TableName: USERS_TABLE,
                    Item: { ...userData, email }
                }).promise();
            }
        }
        
        // Return response based on user type
        const responseData = {
            success: true,
            tokens: {
                idToken: cognitoResult.AuthenticationResult.IdToken,
                accessToken: cognitoResult.AuthenticationResult.AccessToken,
                refreshToken: cognitoResult.AuthenticationResult.RefreshToken
            }
        };
        
        // Add developer-specific data if this is a developer login
        if (userData.userType === 'developer' || userData.developerId) {
            responseData.developer = {
                email: userData.email,
                developerId: userData.developerId,
                companyName: userData.companyName,
                joinDate: userData.joinDate || userData.createdAt
            };
        } else {
            // Mobile app user response
            responseData.user = {
                email: userData.email,
                username: userData.username,
                userId: userData.userId
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(responseData)
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
                message,
                code: error.code
            })
        };
    }
};

// Main handler
exports.handler = async (event) => {
    const path = event.path || event.routeKey?.split(' ')[1] || '';
    const method = event.httpMethod || event.requestContext?.http?.method || '';
    
    console.log(`Handling ${method} ${path}`);
    console.log('Headers:', JSON.stringify(event.headers || {}));
    
    // CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Client',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }
    
    try {
        if (path === '/developers/register' && method === 'POST') {
            // For now, registration goes through login
            // This ensures proper Cognito user creation
            return {
                statusCode: 301,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Location': '/developers/login'
                },
                body: JSON.stringify({
                    message: 'Please use Cognito user pool registration'
                })
            };
        } else if (path === '/developers/login' && method === 'POST') {
            return await exports.login(event);
        } else if (path === '/developers/profile' && method === 'GET') {
            return await exports.getProfile(event);
        } else if (path === '/users/profile' && method === 'GET') {
            // Alias for backward compatibility
            return await exports.getProfile(event);
        } else {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: `Route ${method} ${path} not found`
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
                success: false,
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};