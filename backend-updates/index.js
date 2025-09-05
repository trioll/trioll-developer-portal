const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ResendConfirmationCodeCommand, AdminAddUserToGroupCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';
const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_cLPH2acQd';
const CLIENT_ID = process.env.CLIENT_ID || 'bft50gui77sdq2n4lcio4onql';
const DEVELOPER_CLIENT_ID = process.env.DEVELOPER_APP_CLIENT_ID;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');

// CORS headers - now dynamic based on origin
const getCorsHeaders = (origin) => {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Mode,X-Identity-Id,X-App-Client',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT'
  };
};

// Helper function to generate developer ID
const generateDeveloperId = () => {
  const prefix = 'dev_';
  const randomPart = crypto.randomBytes(3).toString('hex');
  return prefix + randomPart;
};

// Helper function to extract userId from token
const getUserIdFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  
  // Handle guest tokens
  if (token.startsWith('guest-')) {
    return token.replace('guest-', '').replace(/:/g, '_');
  }
  
  // For real JWT tokens, decode the payload
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || payload.username;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

// Helper function to determine which app client to use
const getAppClientId = (headers) => {
  const appClient = headers['X-App-Client'] || headers['x-app-client'];
  
  if (appClient === 'developer-portal' && DEVELOPER_CLIENT_ID) {
    return DEVELOPER_CLIENT_ID;
  }
  
  return CLIENT_ID;
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const path = event.path;
  const method = event.httpMethod;

  try {
    // ==================== DEVELOPER ENDPOINTS ====================
    
    // Developer Registration
    if (path === '/developers/register' && method === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (parseError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid JSON in request body'
          })
        };
      }
      
      const { email, password, companyName, website } = body;
      
      // Validate required fields
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
      const developerId = generateDeveloperId();
      const username = email; // Use email as username for developers
      
      try {
        // Create user in Cognito with developer attributes
        const signUpParams = {
          ClientId: getAppClientId(event.headers),
          Username: email,
          Password: password,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'name', Value: companyName },
            { Name: 'preferred_username', Value: companyName }
          ],
          MessageAction: 'SUPPRESS' // Skip email verification for now
        };
        
        const signUpResult = await cognitoClient.send(new SignUpCommand(signUpParams));
        const userId = signUpResult.UserSub;
        
        // Note: Auto-confirm removed as it requires admin permissions
        // Users are created in CONFIRMED state by using a pre-signup Lambda trigger
        
        // Create developer profile in DynamoDB
        const developerProfile = {
          userId,
          email,
          username: developerId,
          displayName: companyName,
          userType: 'developer',
          developerId: developerId,
          companyName: companyName,
          website: website || '',
          gamesUploaded: 0,
          totalPlays: 0,
          totalRatings: 0,
          averageRating: 0,
          verifiedDeveloper: false,
          developerSince: new Date().toISOString(),
          level: 1,
          xp: 0,
          gamesPlayed: 0,
          totalPlayTime: 0,
          achievements: [],
          friends: [],
          favoriteCategories: [],
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          isGuest: false,
          profilePicture: '',
          bio: '',
          isPremium: false,
          settings: {
            notifications: true,
            soundEnabled: true,
            hapticEnabled: true,
            privacy: 'public'
          }
        };
        
        await docClient.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: developerProfile
        }));
        
        // Add user to developers group
        try {
          await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            GroupName: 'developers'
          }));
        } catch (groupError) {
          console.log('Could not add to group (may not have admin permissions):', groupError);
        }
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Developer registration successful. You can now log in.',
            developerId: developerId,
            requiresVerification: false
          })
        };
        
      } catch (error) {
        console.error('Developer registration error:', error);
        
        let message = 'Registration failed';
        if (error.name === 'UsernameExistsException') {
          message = 'An account with this email already exists';
        } else if (error.name === 'InvalidPasswordException') {
          message = 'Password does not meet requirements (min 8 characters)';
        } else if (error.name === 'InvalidParameterException') {
          message = error.message || 'Invalid registration data';
        }
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message
          })
        };
      }
    }

    // Developer Login (using existing auth endpoint but with developer client)
    if (path === '/developers/login' && method === 'POST') {
      const { email, password } = JSON.parse(event.body);
      
      try {
        const authResult = await cognitoClient.send(new InitiateAuthCommand({
          ClientId: getAppClientId(event.headers),
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password
          }
        }));
        
        // Get developer profile to include in response
        const userIdFromToken = authResult.AuthenticationResult?.IdToken ? 
          JSON.parse(Buffer.from(authResult.AuthenticationResult.IdToken.split('.')[1], 'base64').toString()).sub : null;
        
        let developerInfo = null;
        if (userIdFromToken) {
          try {
            const result = await docClient.send(new GetCommand({
              TableName: USERS_TABLE,
              Key: { userId: userIdFromToken }
            }));
            
            if (result.Item && result.Item.userType === 'developer') {
              developerInfo = {
                developerId: result.Item.developerId,
                companyName: result.Item.companyName,
                email: result.Item.email
              };
            }
          } catch (err) {
            console.log('Could not fetch developer info:', err);
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            tokens: {
              accessToken: authResult.AuthenticationResult.AccessToken,
              refreshToken: authResult.AuthenticationResult.RefreshToken,
              idToken: authResult.AuthenticationResult.IdToken,
              expiresIn: authResult.AuthenticationResult.ExpiresIn
            },
            developer: developerInfo
          })
        };
        
      } catch (error) {
        console.error('Developer login error:', error);
        
        // Handle unverified users
        if (error.name === 'UserNotConfirmedException') {
          console.log('User not confirmed for:', email);
          
          // Return a specific message for unverified users
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Your account needs to be verified. Please contact support at developer@trioll.com to activate your account.',
              requiresVerification: true,
              email: email
            })
          };
        }
        
        // Handle other errors
        let message = 'Login failed';
        if (error.name === 'UserNotFoundException') {
          message = 'Developer account not found';
        } else if (error.name === 'NotAuthorizedException') {
          message = 'Incorrect email or password';
        }
        
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message
          })
        };
      }
    }

    // Get Developer Profile
    if (path === '/developers/profile' && method === 'GET') {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const userId = getUserIdFromToken(authHeader);
      
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Unauthorized'
          })
        };
      }
      
      try {
        const result = await docClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId }
        }));
        
        if (!result.Item || result.Item.userType !== 'developer') {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Developer profile not found'
            })
          };
        }
        
        // Return developer-specific fields
        const developerProfile = {
          developerId: result.Item.developerId,
          companyName: result.Item.companyName,
          email: result.Item.email,
          website: result.Item.website,
          gamesUploaded: result.Item.gamesUploaded || 0,
          totalPlays: result.Item.totalPlays || 0,
          totalRatings: result.Item.totalRatings || 0,
          averageRating: result.Item.averageRating || 0,
          verifiedDeveloper: result.Item.verifiedDeveloper || false,
          developerSince: result.Item.developerSince || result.Item.createdAt,
          profilePicture: result.Item.profilePicture || '',
          bio: result.Item.bio || ''
        };
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            developer: developerProfile
          })
        };
        
      } catch (error) {
        console.error('Get developer profile error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Failed to get developer profile'
          })
        };
      }
    }

    // Update Developer Profile
    if (path === '/developers/profile' && method === 'PUT') {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const userId = getUserIdFromToken(authHeader);
      
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Unauthorized'
          })
        };
      }
      
      const updates = JSON.parse(event.body);
      
      // Only allow updating certain fields
      const allowedFields = ['companyName', 'website', 'bio', 'profilePicture'];
      const filteredUpdates = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }
      
      filteredUpdates.lastActiveAt = new Date().toISOString();
      
      try {
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        Object.keys(filteredUpdates).forEach(key => {
          updateExpressions.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = filteredUpdates[key];
        });
        
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ConditionExpression: 'userType = :developerType',
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ':developerType': 'developer'
          }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Developer profile updated successfully'
          })
        };
        
      } catch (error) {
        console.error('Update developer profile error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Failed to update developer profile'
          })
        };
      }
    }

    // ==================== EXISTING ENDPOINTS (KEEP AS IS) ====================
    
    // User Registration (existing - for mobile app)
    if (path === '/users/register' && method === 'POST') {
      // ... existing user registration code ...
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid JSON in request body'
          })
        };
      }
      
      const { email, username, password, displayName } = body;
      
      // Check if user already exists in DynamoDB
      try {
        const existingUser = await docClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { email }
        }));
        
        if (existingUser.Item) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'An account with this email already exists'
            })
          };
        }
      } catch (dbError) {
        // User doesn't exist, continue with registration
      }
      
      // Generate unique username if not provided
      const finalUsername = username || email.split('@')[0] + '_' + Date.now().toString(36);
      
      try {
        // Create user in Cognito
        const signUpParams = {
          ClientId: CLIENT_ID,
          Username: email,
          Password: password,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'name', Value: displayName || finalUsername },
            { Name: 'preferred_username', Value: finalUsername }
          ]
        };
        
        const signUpResult = await cognitoClient.send(new SignUpCommand(signUpParams));
        const userId = signUpResult.UserSub;
        
        // Create user profile in DynamoDB
        const userProfile = {
          userId,
          email,
          username: finalUsername,
          displayName: displayName || finalUsername,
          userType: 'player', // Regular mobile app user
          level: 1,
          xp: 0,
          gamesPlayed: 0,
          totalPlayTime: 0,
          achievements: [],
          friends: [],
          favoriteCategories: [],
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          isGuest: false,
          profilePicture: '',
          bio: '',
          isPremium: false,
          settings: {
            notifications: true,
            soundEnabled: true,
            hapticEnabled: true,
            privacy: 'public'
          }
        };
        
        await docClient.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: userProfile
        }));
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Registration successful. Please check your email for verification code.',
            userId,
            requiresVerification: true
          })
        };
        
      } catch (error) {
        console.error('Registration error:', error);
        
        let message = 'Registration failed';
        if (error.name === 'UsernameExistsException') {
          message = 'An account with this email already exists';
        } else if (error.name === 'InvalidPasswordException') {
          message = 'Password does not meet requirements';
        } else if (error.name === 'InvalidParameterException') {
          message = error.message || 'Invalid registration data';
        }
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message
          })
        };
      }
    }

    // Include all other existing endpoints here...
    // (Email verification, resend verification, get user profile, update user profile, login)
    // These remain unchanged from the original file

    // If no route matched
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Route not found'
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