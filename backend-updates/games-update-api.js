// Minimal version without jsonwebtoken dependency

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = process.env.GAMES_TABLE || 'trioll-prod-games';

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
      body: JSON.stringify({ message: 'OK' })
    };
  }
  
  // Check HTTP method
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }
  
  // Get gameId from path
  const gameId = event.pathParameters?.gameId;
  if (!gameId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Missing gameId' })
    };
  }
  
  // Parse request body
  let updates;
  try {
    updates = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Invalid JSON in request body' })
    };
  }
  
  // Get developer info from token
  let developer;
  try {
    developer = getDeveloperFromToken(event.headers.Authorization || event.headers.authorization);
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: 'Unauthorized', error: error.message })
    };
  }
  
  if (!developer.developerId) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ message: 'Developer ID not found in token' })
    };
  }
  
  try {
    // First, query to get the latest version of the game
    const queryResult = await dynamodb.send(new QueryCommand({
      TableName: GAMES_TABLE,
      KeyConditionExpression: 'gameId = :gameId',
      ExpressionAttributeValues: {
        ':gameId': gameId
      },
      ScanIndexForward: false, // Get latest version first
      Limit: 1
    }));
    
    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Game not found' })
      };
    }
    
    const game = queryResult.Items[0];
    
    // Check ownership
    if (game.developerId !== developer.developerId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          message: 'Access denied. You can only update your own games.',
          gameDeveloperId: game.developerId,
          yourDeveloperId: developer.developerId
        })
      };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString(),
      ':updatedBy': developer.email
    };
    
    // Add updatedAt and updatedBy
    updateExpressions.push('#updatedAt = :updatedAt');
    updateExpressions.push('#updatedBy = :updatedBy');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeNames['#updatedBy'] = 'updatedBy';
    
    // Only allow updating certain fields
    const allowedFields = ['name', 'title', 'description', 'category', 'status', 'deviceOrientation', 'controlStyle', 'gameStage'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }
    
    // Perform the update with the correct key (including version)
    const updateResult = await dynamodb.send(new UpdateCommand({
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: game.version || '1.0.0' // Use the version from the queried game
      },
      UpdateExpression: 'SET ' + updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Game updated successfully',
        game: updateResult.Attributes
      })
    };
    
  } catch (error) {
    console.error('Error updating game:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Failed to update game',
        error: error.message
      })
    };
  }
};