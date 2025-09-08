// Fixed version of games-update-api that handles versioned table schema

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const jwt = require('jsonwebtoken');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = process.env.GAMES_TABLE || 'trioll-prod-games';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

// CORS headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-App-Client',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS'
};

// Extract developer info from JWT token
const getDeveloperFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Decode JWT without verification (API Gateway already validates)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    return {
      userId: payload.sub,
      email: payload.email || payload['cognito:username'],
      // Support both custom attributes (currently in use) and standard attributes (future)
      developerId: payload['custom:developer_id'] || payload.preferred_username || null,
      companyName: payload['custom:company_name'] || payload.website || null,
      userType: payload['custom:user_type'] || payload.profile || 'player'
    };
  } catch (error) {
    console.error('Token decode error:', error);
    throw new Error('Invalid or expired token');
  }
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
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
    
    // Parse request body
    let updates;
    try {
      updates = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid request body' 
        })
      };
    }
    
    // Get developer info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const developer = getDeveloperFromToken(authHeader);
    
    if (!developer.developerId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Developer authentication required' 
        })
      };
    }
    
    console.log('Developer:', developer.email, 'updating game:', gameId);
    
    // First, query to get the latest version of the game
    const queryParams = {
      TableName: GAMES_TABLE,
      KeyConditionExpression: 'gameId = :gameId',
      ExpressionAttributeValues: {
        ':gameId': gameId
      },
      ScanIndexForward: false,  // Get latest version first
      Limit: 1
    };
    
    const queryResult = await dynamodb.send(new QueryCommand(queryParams));
    
    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          message: 'Game not found' 
        })
      };
    }
    
    const game = queryResult.Items[0];
    
    // Verify developer owns this game
    if (game.developerId !== developer.developerId) {
      console.log('Ownership check failed:', {
        gameDeveloperId: game.developerId,
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
      name: 'title',
      description: 'description',
      category: 'category',
      status: 'status',
      thumbnailUrl: 'thumbnailUrl'
    };
    
    // Process each update field
    for (const [frontendField, value] of Object.entries(updates)) {
      const backendField = fieldMappings[frontendField];
      if (backendField && value !== undefined) {
        updateExpressionParts.push(`#${backendField} = :${backendField}`);
        expressionAttributeNames[`#${backendField}`] = backendField;
        expressionAttributeValues[`:${backendField}`] = value;
        
        // Special handling for certain fields
        if (frontendField === 'category') {
          updateExpressionParts.push('#genre = :genre');
          expressionAttributeNames['#genre'] = 'genre';
          expressionAttributeValues[':genre'] = value;
        }
        
        if (frontendField === 'thumbnailUrl') {
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
    
    // Update the game
    const updateParams = {
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: game.version  // Use the version from the queried game
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamodb.send(new UpdateCommand(updateParams));
    
    // Transform the response to match frontend expectations
    const updatedGame = {
      gameId: updateResult.Attributes.gameId,
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