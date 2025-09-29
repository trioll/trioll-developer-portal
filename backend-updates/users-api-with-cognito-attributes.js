// Updated Lambda handler that uses Cognito standard attributes for developer info
// Maps: preferred_username -> developer_id, website -> company_name, profile -> user_type

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, SignUpCommand, InitiateAuthCommand, AdminUpdateUserAttributesCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';
const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd';
const CLIENT_ID = process.env.CLIENT_ID || 'bft50gui77sdq2n4lcio4onql';
const DEVELOPER_CLIENT_ID = process.env.DEVELOPER_APP_CLIENT_ID || '5joogquqr4jgukp7mncgp3g23h';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');

// CORS headers
const getCorsHeaders = (origin) => {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Mode,X-Identity-Id,X-App-Client',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT'
  };
};

// Generate unique developer ID with proper increments
async function generateDeveloperId(email) {
  const username = email.split('@')[0].toLowerCase();
  const baseId = username.substring(0, 6).padEnd(6, '0').replace(/[^a-z0-9]/g, '0');
  
  try {
    // Query existing developer IDs
    const scanParams = {
      TableName: USERS_TABLE,
      FilterExpression: 'begins_with(developerId, :baseId)',
      ExpressionAttributeValues: {
        ':baseId': `dev_${baseId}`
      },
      ProjectionExpression: 'developerId'
    };
    
    const result = await docClient.send(new QueryCommand(scanParams));
    
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
    
    return maxNumber === 0 ? `dev_${baseId}` : `${basePattern}${maxNumber + 1}`;
    
  } catch (error) {
    console.error('Error generating developer ID:', error);
    // Fallback to random suffix
    const randomPart = crypto.randomBytes(3).toString('hex');
    return `dev_${baseId}_${randomPart}`;
  }
}

// Extract developer info from JWT token
const getDeveloperFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    return {
      userId: payload.sub,
      email: payload.email,
      // Map standard attributes to developer fields
      developerId: payload.preferred_username || null,
      companyName: payload.website || null,
      userType: payload.profile || 'player'
    };
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

// Update Cognito user attributes
async function updateCognitoAttributes(username, developerId, companyName, userType = 'developer') {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: 'preferred_username', Value: developerId },
        { Name: 'website', Value: companyName },
        { Name: 'profile', Value: userType }
      ]
    };
    
    await cognitoClient.send(new AdminUpdateUserAttributesCommand(params));
    console.log('✅ Updated Cognito attributes for user:', username);
  } catch (error) {
    console.error('Error updating Cognito attributes:', error);
    // Don't throw - continue even if update fails
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path;
  const method = event.httpMethod;
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  try {
    // Developer Registration
    if (path === '/developers/register' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password, companyName } = body;
      
      if (!email || !password || !companyName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email, password, and company name are required'
          })
        };
      }
      
      // Generate developer ID
      const developerId = await generateDeveloperId(email);
      const timestamp = new Date().toISOString();
      
      // Create Cognito user with developer attributes
      const signUpParams = {
        ClientId: DEVELOPER_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'preferred_username', Value: developerId },
          { Name: 'website', Value: companyName },
          { Name: 'profile', Value: 'developer' }
        ]
      };
      
      try {
        const signUpResult = await cognitoClient.send(new SignUpCommand(signUpParams));
        const userId = signUpResult.UserSub;
        
        // Auto-confirm user
        if (!signUpResult.UserConfirmed) {
          await cognitoClient.send(new AdminConfirmSignUpCommand({
            UserPoolId: USER_POOL_ID,
            Username: email
          }));
        }
        
        // Save to DynamoDB
        await docClient.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            userId,
            email,
            developerId,
            companyName,
            userType: 'developer',
            createdAt: timestamp,
            updatedAt: timestamp
          }
        }));
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Developer account created successfully',
            developerId
          })
        };
        
      } catch (error) {
        console.error('Registration error:', error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: error.message || 'Registration failed'
          })
        };
      }
    }
    
    // Developer Login
    if (path === '/developers/login' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;
      
      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email and password are required'
          })
        };
      }
      
      try {
        // Authenticate with Cognito
        const authResult = await cognitoClient.send(new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: DEVELOPER_CLIENT_ID,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password
          }
        }));
        
        // Get developer info from token
        const idToken = authResult.AuthenticationResult.IdToken;
        const developer = getDeveloperFromToken(`Bearer ${idToken}`);
        
        // If no developer attributes in token, update them
        if (!developer.developerId) {
          // Look up from DynamoDB
          let userData;
          try {
            const result = await docClient.send(new GetCommand({
              TableName: USERS_TABLE,
              Key: { userId: developer.userId }
            }));
            userData = result.Item;
          } catch (err) {
            console.log('No user found by userId, trying email');
          }
          
          // No special cases - all users are treated equally
          // Developer IDs must exist in the database
          
          if (userData?.developerId) {
            // Update Cognito attributes
            await updateCognitoAttributes(email, userData.developerId, userData.companyName, 'developer');
            
            // Update developer object
            developer.developerId = userData.developerId;
            developer.companyName = userData.companyName;
            developer.userType = 'developer';
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            tokens: {
              idToken: authResult.AuthenticationResult.IdToken,
              accessToken: authResult.AuthenticationResult.AccessToken,
              refreshToken: authResult.AuthenticationResult.RefreshToken
            },
            developer: {
              email: developer.email,
              developerId: developer.developerId,
              companyName: developer.companyName
            }
          })
        };
        
      } catch (error) {
        console.error('Login error:', error);
        
        // Auto-confirm if needed
        if (error.name === 'UserNotConfirmedException') {
          try {
            await cognitoClient.send(new AdminConfirmSignUpCommand({
              UserPoolId: USER_POOL_ID,
              Username: email
            }));
            // Retry login
            return exports.handler(event);
          } catch (confirmError) {
            console.error('Auto-confirm error:', confirmError);
          }
        }
        
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'
          })
        };
      }
    }
    
    // Developer Profile
    if (path === '/developers/profile' && method === 'GET') {
      const developer = getDeveloperFromToken(authHeader);
      
      if (!developer || !developer.developerId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Unauthorized'
          })
        };
      }
      
      // Get additional data from DynamoDB if needed
      let userData;
      try {
        const result = await docClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: developer.userId }
        }));
        userData = result.Item;
      } catch (err) {
        console.log('Could not fetch additional user data');
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          developer: {
            email: developer.email,
            developerId: developer.developerId,
            companyName: developer.companyName,
            joinDate: userData?.createdAt || new Date().toISOString(),
            gamesCount: userData?.gamesCount || 0,
            totalPlays: userData?.totalPlays || 0
          }
        })
      };
    }
    
    // Default 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found'
      })
    };
    
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error'
      })
    };
  }
};