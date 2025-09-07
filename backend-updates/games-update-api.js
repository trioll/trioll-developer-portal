// Games Update API Lambda Function
// Handles PUT /games/{gameId} requests for updating game metadata

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { promisify } = require('util');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';
const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const REGION = 'us-east-1';
const DEVELOPER_CLIENT_ID = '5joogquqr4jgukp7mncgp3g23h';

// JWKS client for token validation
const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const jwks = jwksClient({
  jwksUri,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

const getSigningKey = promisify(jwks.getSigningKey.bind(jwks));

// Dynamic CORS headers
const getCorsHeaders = (origin) => {
  const allowedOrigins = [
    'https://triolldev.com',
    'https://www.triolldev.com',
    'http://localhost:3000',
    'http://localhost:8080'
  ];
  
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : 'https://triolldev.com';
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-App-Client',
    'Access-Control-Allow-Methods': 'PUT,OPTIONS'
  };
};

// Validate JWT token
async function validateToken(token) {
  try {
    // Decode token header to get key ID
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader) {
      throw new Error('Invalid token format');
    }
    
    // Get signing key
    const key = await getSigningKey(decodedHeader.header.kid);
    const signingKey = key.getPublicKey();
    
    // Verify token
    const decoded = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
      audience: DEVELOPER_CLIENT_ID
    });
    
    return decoded;
  } catch (error) {
    console.error('Token validation error:', error);
    throw new Error('Invalid or expired token');
  }
}

// Extract developer info from validated token
function getDeveloperInfo(decodedToken) {
  // Try to get developer ID from multiple possible locations in the token
  const developerId = decodedToken['custom:developer_id'] || 
                     decodedToken.developerId ||
                     (decodedToken.email ? 'dev_' + decodedToken.email.split('@')[0].substring(0, 6) : null);
  
  return {
    userId: decodedToken.sub,
    email: decodedToken.email || decodedToken['cognito:username'],
    developerId: developerId,
    companyName: decodedToken['custom:company_name'] || null
  };
}

// Validate update data
function validateUpdateData(updates) {
  const allowedFields = ['name', 'description', 'category', 'status', 'thumbnailUrl'];
  const validCategories = [
    'Action', 'Adventure', 'Arcade', 'Puzzle', 'Racing', 
    'Sports', 'Strategy', 'Simulation', 'Educational', 'Other'
  ];
  const validStatuses = ['active', 'inactive'];
  
  // Check for unknown fields
  const unknownFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    throw new Error(`Unknown fields: ${unknownFields.join(', ')}`);
  }
  
  // Validate category if provided
  if (updates.category && !validCategories.includes(updates.category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }
  
  // Validate status if provided
  if (updates.status && !validStatuses.includes(updates.status)) {
    throw new Error('Invalid status. Must be "active" or "inactive"');
  }
  
  // Validate required string fields are not empty
  if (updates.name !== undefined && (!updates.name || updates.name.trim() === '')) {
    throw new Error('Game name cannot be empty');
  }
  
  return true;
}

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
  
  try {
    // Extract gameId from path
    const gameId = event.pathParameters?.gameId || event.pathParameters?.id;
    if (!gameId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Game ID is required' 
        })
      };
    }
    
    // Check for authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'No authorization token provided' 
        })
      };
    }
    
    // Validate token and get developer info
    const token = authHeader.split(' ')[1];
    const decodedToken = await validateToken(token);
    const developer = getDeveloperInfo(decodedToken);
    
    if (!developer.developerId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Developer ID not found in token' 
        })
      };
    }
    
    console.log('Developer:', developer.email, 'ID:', developer.developerId);
    
    // Parse request body
    const updates = JSON.parse(event.body || '{}');
    
    // Validate update data
    try {
      validateUpdateData(updates);
    } catch (validationError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: validationError.message 
        })
      };
    }
    
    // First, get the game to verify ownership
    const getParams = {
      TableName: GAMES_TABLE,
      Key: {
        id: gameId
      }
    };
    
    const gameResult = await dynamodb.send(new GetCommand(getParams));
    
    if (!gameResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Game not found' 
        })
      };
    }
    
    // Verify developer owns this game
    if (gameResult.Item.developerId !== developer.developerId) {
      console.log('Ownership check failed:', {
        gameDeveloperId: gameResult.Item.developerId,
        requestDeveloperId: developer.developerId
      });
      
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'You can only update games you uploaded' 
        })
      };
    }
    
    // Build update expression
    const updateExpressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Map frontend field names to backend field names
    const fieldMappings = {
      name: 'title',        // Frontend 'name' -> Backend 'title'
      description: 'description',
      category: 'category',
      status: 'status',
      thumbnailUrl: 'thumbnailUrl'
    };
    
    // Process each update field
    for (const [frontendField, value] of Object.entries(updates)) {
      const backendField = fieldMappings[frontendField];
      if (backendField) {
        updateExpressionParts.push(`#${backendField} = :${backendField}`);
        expressionAttributeNames[`#${backendField}`] = backendField;
        expressionAttributeValues[`:${backendField}`] = value;
        
        // Special handling for certain fields
        if (frontendField === 'category') {
          // Also update genre to match category
          updateExpressionParts.push('#genre = :genre');
          expressionAttributeNames['#genre'] = 'genre';
          expressionAttributeValues[':genre'] = value;
        }
        
        if (frontendField === 'thumbnailUrl') {
          // Also update imageUrl to match thumbnailUrl
          updateExpressionParts.push('#imageUrl = :imageUrl');
          expressionAttributeNames['#imageUrl'] = 'imageUrl';
          expressionAttributeValues[':imageUrl'] = value;
        }
      }
    }
    
    // Always update the updatedAt timestamp
    updateExpressionParts.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    // Build the final update expression
    const updateExpression = 'SET ' + updateExpressionParts.join(', ');
    
    console.log('Update expression:', updateExpression);
    console.log('Expression attribute names:', expressionAttributeNames);
    console.log('Expression attribute values:', expressionAttributeValues);
    
    // Update the game
    const updateParams = {
      TableName: GAMES_TABLE,
      Key: {
        id: gameId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamodb.send(new UpdateCommand(updateParams));
    
    // Transform the response to match frontend expectations
    const updatedGame = {
      gameId: updateResult.Attributes.id,
      name: updateResult.Attributes.title,
      description: updateResult.Attributes.description,
      category: updateResult.Attributes.category,
      status: updateResult.Attributes.status,
      developerId: updateResult.Attributes.developerId,
      thumbnailUrl: updateResult.Attributes.thumbnailUrl,
      gameUrl: updateResult.Attributes.gameUrl || updateResult.Attributes.trialUrl,
      updatedAt: updateResult.Attributes.updatedAt,
      publishedAt: updateResult.Attributes.publishedAt || updateResult.Attributes.createdAt
    };
    
    console.log('Game updated successfully:', gameId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        game: updatedGame
      })
    };
    
  } catch (error) {
    console.error('Error updating game:', error);
    
    // Handle specific error types
    if (error.message === 'Invalid or expired token') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid or expired token' 
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};