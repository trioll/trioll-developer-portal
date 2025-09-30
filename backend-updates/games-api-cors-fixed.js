// Games API Lambda Function with Developer Authentication and Full CORS Support
// Returns game data in the exact format expected by the mobile app

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Use environment variables with production defaults
const GAMES_TABLE = process.env.GAMES_TABLE || 'trioll-prod-games';
const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

// CORS headers with all required headers for cross-platform support
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Mode,X-Identity-Id,X-Platform,X-App-Source,X-App-Client',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

// Helper function to extract developer info from JWT token
const getDeveloperFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No Bearer token in auth header');
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    console.log('Token payload:', JSON.stringify(payload, null, 2));
    
    // Check multiple possible locations for developer ID
    let developerId = null;
    let userType = 'player';
    
    // Priority order for finding developer ID:
    // 1. custom:developer_id (Cognito custom attribute)
    developerId = payload['custom:developer_id'] || null;
    
    // 2. Check if it's in the root level
    if (!developerId) {
      developerId = payload.developer_id || payload.developerId || null;
    }
    
    // 3. Generate from email if still not found
    if (!developerId && payload.email) {
      const username = payload.email.split('@')[0];
      developerId = 'dev_' + username.substring(0, 6).padEnd(6, '0').replace(/[^a-zA-Z0-9]/g, '0');
      console.log('Generated developerId from email:', developerId);
    }
    
    // Check user type
    userType = payload['custom:user_type'] || payload.user_type || payload.userType || 'player';
    
    const developerInfo = {
      userId: payload.sub,
      email: payload.email || payload['cognito:username'],
      developerId: developerId,
      userType: userType,
      companyName: payload['custom:company_name'] || payload.company_name || payload.preferred_username
    };
    
    console.log('Extracted developer info:', developerInfo);
    return developerInfo;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

// Transform game data for consistent output
const transformGameForResponse = (game, isV0 = false) => {
  if (isV0) {
    // V0 record (stats) - return as is
    return game;
  }
  
  // For version 1.0.0 records, ensure consistent format
  return {
    // Always include id as gameId
    id: game.gameId || game.id,
    gameId: game.gameId || game.id,
    
    // Core fields
    title: game.title || game.name,
    name: game.title || game.name,
    description: game.description || '',
    category: game.category || 'Uncategorized',
    developer: game.developer || 'Unknown Developer',
    developerId: game.developerId || null,
    
    // URLs - ensure proper CDN URLs
    gameUrl: game.gameUrl || `https://dgq2nqysbn2z3.cloudfront.net/${game.gameId}/index.html`,
    thumbnailUrl: game.thumbnailUrl || `https://dgq2nqysbn2z3.cloudfront.net/${game.gameId}/thumbnail.png`,
    
    // Game settings
    deviceOrientation: game.deviceOrientation || 'Portrait',
    controlStyle: game.controlStyle || 'Touch',
    buildId: game.buildId || '1.0',
    status: game.status || 'active',
    gameStage: game.gameStage || 'Released (In App Store)',
    deviceCompatibility: game.deviceCompatibility || ['All of the Above'],
    
    // Stats - merge from v0 record if available
    plays: game.plays || 0,
    likes: game.likes || 0,
    rating: game.rating || 0,
    totalRatings: game.totalRatings || 0,
    
    // Timestamps
    uploadedAt: game.uploadedAt || game.createdAt || new Date().toISOString(),
    publishedAt: game.publishedAt || game.uploadedAt || game.createdAt || new Date().toISOString(),
    createdAt: game.createdAt || game.uploadedAt || new Date().toISOString(),
    updatedAt: game.updatedAt || new Date().toISOString(),
    
    // S3 info
    s3Folder: game.s3Folder || game.gameId,
    uploadedFiles: game.uploadedFiles || 0,
    
    // Version
    version: '1.0.0'
  };
};

// Handle GET /games
exports.getGames = async (event) => {
  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit) || 20;
  const cursor = queryParams.cursor;
  const platform = queryParams.platform || 'all';
  
  console.log('GetGames request:', { limit, cursor, platform });
  
  try {
    // Use Query on status-uploadedAt-index for efficient retrieval
    const params = {
      TableName: GAMES_TABLE,
      IndexName: 'status-uploadedAt-index',
      KeyConditionExpression: '#status = :status',
      FilterExpression: '#version = :version',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#version': 'version'
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':version': '1.0.0'
      },
      Limit: limit,
      ScanIndexForward: false // Sort by uploadedAt descending (newest first)
    };
    
    if (cursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString());
    }
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    const games = result.Items.map(game => transformGameForResponse(game));
    
    const response = {
      games: games,
      pagination: {
        cursor: result.LastEvaluatedKey ? 
          Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null,
        hasMore: !!result.LastEvaluatedKey
      }
    };
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('GetGames error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Failed to fetch games',
        error: error.message
      })
    };
  }
};

// Handle GET /games/{gameId}
exports.getGame = async (event) => {
  const gameId = event.pathParameters?.gameId || event.pathParameters?.id;
  
  if (!gameId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Game ID is required' })
    };
  }
  
  console.log('GetGame request for:', gameId);
  
  try {
    // Get version 1.0.0 record (main data)
    const mainResult = await dynamodb.send(new GetCommand({
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: '1.0.0'
      }
    }));
    
    // Get v0 record (stats)
    const statsResult = await dynamodb.send(new GetCommand({
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: 'v0'
      }
    }));
    
    if (!mainResult.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Game not found' })
      };
    }
    
    // Merge stats if available
    const game = mainResult.Item;
    if (statsResult.Item) {
      game.plays = statsResult.Item.plays || 0;
      game.likes = statsResult.Item.likes || 0;
      game.rating = statsResult.Item.rating || 0;
      game.totalRatings = statsResult.Item.totalRatings || 0;
    }
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(transformGameForResponse(game))
    };
  } catch (error) {
    console.error('GetGame error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Failed to fetch game',
        error: error.message
      })
    };
  }
};

// Handle POST /games (Create new game)
exports.createGame = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Invalid JSON body' })
    };
  }
  
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const developerInfo = getDeveloperFromToken(authHeader);
  
  console.log('CreateGame request from developer:', developerInfo);
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  // Required fields
  const requiredFields = ['gameId', 'name', 'description', 'category', 'developer', 
                         'deviceOrientation', 'controlStyle', 'gameStage', 'deviceCompatibility',
                         'gameUrl', 'thumbnailUrl'];
  
  const missingFields = requiredFields.filter(field => !body[field] && !body[field === 'name' ? 'title' : field]);
  
  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: `Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`,
        receivedFields: Object.keys(body)
      })
    };
  }
  
  // Use developer info from token if available
  if (developerInfo && developerInfo.developerId) {
    body.developerId = developerInfo.developerId;
    // Also set developer name if not provided
    if (!body.developer || body.developer === 'Unknown Developer') {
      body.developer = developerInfo.companyName || developerInfo.email.split('@')[0];
    }
  }
  
  const timestamp = new Date().toISOString();
  const gameData = {
    gameId: body.gameId,
    version: '1.0.0',  // CRITICAL: Must include version field
    title: body.name || body.title,
    name: body.name || body.title,
    description: body.description,
    category: body.category,
    developer: body.developer,
    developerId: body.developerId || developerInfo?.developerId || null,
    deviceOrientation: body.deviceOrientation,
    controlStyle: body.controlStyle,
    buildId: body.buildId || '1.0',
    status: body.status || 'active',
    gameStage: body.gameStage,
    deviceCompatibility: body.deviceCompatibility,
    gameUrl: body.gameUrl,
    thumbnailUrl: body.thumbnailUrl,
    s3Folder: body.s3Folder || body.gameId,
    uploadedFiles: body.uploadedFiles || 0,
    uploadedAt: timestamp,
    publishedAt: body.publishedAt || timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    // Initialize stats to 0
    plays: 0,
    likes: 0,
    rating: 0,
    totalRatings: 0
  };
  
  try {
    // Create the game record
    await dynamodb.send(new PutCommand({
      TableName: GAMES_TABLE,
      Item: gameData
    }));
    
    // Also create v0 stats record
    await dynamodb.send(new PutCommand({
      TableName: GAMES_TABLE,
      Item: {
        gameId: body.gameId,
        version: 'v0',
        plays: 0,
        likes: 0,
        rating: 0,
        totalRatings: 0,
        lastUpdated: timestamp
      }
    }));
    
    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        gameId: gameData.gameId,
        message: 'Game created successfully'
      })
    };
  } catch (error) {
    console.error('CreateGame error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to create game',
        details: error.message
      })
    };
  }
};

// Handle PUT /games/{gameId} (Update existing game)
exports.updateGame = async (event) => {
  const gameId = event.pathParameters?.gameId || event.pathParameters?.id;
  
  if (!gameId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Game ID is required' })
    };
  }
  
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Invalid JSON body' })
    };
  }
  
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const developerInfo = getDeveloperFromToken(authHeader);
  
  console.log('UpdateGame request for:', gameId, 'from developer:', developerInfo);
  
  try {
    // Get existing game to verify ownership
    const existingGame = await dynamodb.send(new GetCommand({
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: '1.0.0'
      }
    }));
    
    if (!existingGame.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Game not found' })
      };
    }
    
    // Check if user is the developer
    if (developerInfo && existingGame.Item.developerId && 
        existingGame.Item.developerId !== developerInfo.developerId) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'You do not have permission to update this game' })
      };
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    const updateableFields = ['name', 'title', 'description', 'category', 'deviceOrientation',
                             'controlStyle', 'gameStage', 'deviceCompatibility', 'status',
                             'gameUrl', 'thumbnailUrl'];
    
    updateableFields.forEach(field => {
      if (body[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = body[field];
      }
    });
    
    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    await dynamodb.send(new UpdateCommand({
      TableName: GAMES_TABLE,
      Key: {
        gameId: gameId,
        version: '1.0.0'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Game updated successfully'
      })
    };
  } catch (error) {
    console.error('UpdateGame error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Failed to update game',
        error: error.message
      })
    };
  }
};

// Handle GET /developers/games
exports.getDeveloperGames = async (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const developerInfo = getDeveloperFromToken(authHeader);
  
  if (!developerInfo || !developerInfo.developerId) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Developer authentication required' })
    };
  }
  
  console.log('GetDeveloperGames for:', developerInfo.developerId);
  
  try {
    // Query games by developerId
    const params = {
      TableName: GAMES_TABLE,
      IndexName: 'developerId-index',
      KeyConditionExpression: 'developerId = :developerId',
      ExpressionAttributeValues: {
        ':developerId': developerInfo.developerId
      }
    };
    
    const result = await dynamodb.send(new QueryCommand(params));
    
    // Filter for version 1.0.0 records only
    const games = result.Items
      .filter(game => game.version === '1.0.0')
      .map(game => transformGameForResponse(game));
    
    // Calculate stats
    const stats = {
      totalGames: games.length,
      totalPlays: games.reduce((sum, game) => sum + (game.plays || 0), 0),
      totalLikes: games.reduce((sum, game) => sum + (game.likes || 0), 0),
      averageRating: games.length > 0 ? 
        games.reduce((sum, game) => sum + (game.rating || 0), 0) / games.length : 0
    };
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        games: games,
        stats: stats
      })
    };
  } catch (error) {
    console.error('GetDeveloperGames error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Failed to fetch developer games',
        error: error.message
      })
    };
  }
};

// Lambda handler
exports.handler = async (event) => {
  console.log('Games API Request:', event.httpMethod, event.path);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  
  const path = event.path;
  const method = event.httpMethod;
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }
  
  // Route requests
  if (path === '/games' && method === 'GET') {
    return exports.getGames(event);
  } else if (path === '/games' && method === 'POST') {
    return exports.createGame(event);
  } else if (path.match(/^\/games\/[^\/]+$/) && method === 'GET') {
    return exports.getGame(event);
  } else if (path.match(/^\/games\/[^\/]+$/) && method === 'PUT') {
    return exports.updateGame(event);
  } else if (path === '/developers/games' && method === 'GET') {
    return exports.getDeveloperGames(event);
  } else {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Not found' })
    };
  }
};