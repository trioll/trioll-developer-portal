// Hotfix for Games API Lambda Function
// This version properly handles developer authentication by looking up developer ID from DynamoDB

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';
const USERS_TABLE = 'trioll-prod-users';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',');

// Dynamic CORS headers based on origin
const getCorsHeaders = (origin) => {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-App-Client',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
};

// Enhanced helper to get developer info from token AND database
async function getDeveloperFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    // Basic token info
    const tokenInfo = {
      userId: payload.sub,
      email: payload.email,
      developerId: payload['custom:developer_id'] || null,
      companyName: payload['custom:company_name'] || null,
      userType: payload['custom:user_type'] || 'player',
      groups: payload['cognito:groups'] || []
    };
    
    // If no developerId in token, look it up from database
    if (!tokenInfo.developerId && tokenInfo.userId) {
      console.log('No developerId in token, looking up from database for userId:', tokenInfo.userId);
      
      try {
        const userResult = await dynamodb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: tokenInfo.userId }
        }));
        
        if (userResult.Item) {
          console.log('Found user in database:', userResult.Item.email);
          tokenInfo.developerId = userResult.Item.developerId || null;
          tokenInfo.companyName = userResult.Item.companyName || tokenInfo.companyName;
          tokenInfo.userType = userResult.Item.userType || tokenInfo.userType;
          
          // For backwards compatibility, also check if this is freddiecaplin@hotmail.com
          if (userResult.Item.email === 'freddiecaplin@hotmail.com' && !tokenInfo.developerId) {
            console.log('Setting default developerId for freddiecaplin@hotmail.com');
            tokenInfo.developerId = 'dev_c84a7e';
          }
        }
      } catch (dbError) {
        console.error('Error looking up user from database:', dbError);
      }
    }
    
    console.log('Final developer info:', {
      userId: tokenInfo.userId,
      email: tokenInfo.email,
      developerId: tokenInfo.developerId,
      hasDeveloperId: !!tokenInfo.developerId
    });
    
    return tokenInfo;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

// Helper function to filter games from trioll-prod-games-us-east-1 bucket
function filterTriollGames(games) {
  const validDomains = [
    'trioll-prod-games-us-east-1.s3.amazonaws.com',
    'dk72g9i0333mv.cloudfront.net'
  ];
  
  return games.filter(game => {
    if (!game.trialUrl || game.trialUrl === '') {
      return true;
    }
    return validDomains.some(domain => game.trialUrl.includes(domain));
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = getCorsHeaders(origin);
  
  const response = {
    statusCode: 200,
    headers,
    body: ''
  };
  
  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return response;
  }
  
  try {
    const path = event.path || event.rawPath || '';
    const pathParameters = event.pathParameters || {};
    const queryParameters = event.queryStringParameters || {};
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    // Route handling - FIXED ORDER
    if (path === '/developers/games' && event.httpMethod === 'GET') {
      console.log('Route matched: /developers/games');
      return await handleDeveloperGames(authHeader);
    } else if (path.endsWith('/games/featured')) {
      return await handleFeaturedGames();
    } else if (path.includes('/games/search')) {
      return await handleSearchGames(queryParameters.q || '');
    } else if (path.includes('/games/category/')) {
      const category = pathParameters.category || path.split('/').pop();
      return await handleGamesByCategory(category);
    } else if (pathParameters.id) {
      return await handleGetGameById(pathParameters.id);
    } else if (path === '/games' || path.endsWith('/games')) {
      const httpMethod = event.httpMethod || event.requestContext?.http?.method;
      if (httpMethod === 'POST') {
        return await handleCreateGame(event.body, authHeader);
      }
      return await handleGetGames(queryParameters);
    }
    
    response.statusCode = 404;
    response.body = JSON.stringify({ 
      success: false,
      message: `Route ${event.httpMethod} ${path} not found` 
    });
    
  } catch (error) {
    console.error('Error:', error);
    response.statusCode = 500;
    response.body = JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
  
  return response;
};

// Handle developer's games with enhanced authentication
async function handleDeveloperGames(authHeader) {
  console.log('handleDeveloperGames called');
  
  const developer = await getDeveloperFromToken(authHeader);
  console.log('Developer info:', developer);
  
  if (!developer || !developer.developerId) {
    return {
      statusCode: 401,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: false,
        message: 'Unauthorized. Developer authentication required.',
        hasDeveloperId: !!developer?.developerId,
        debug: {
          hasAuth: !!developer,
          userId: developer?.userId,
          email: developer?.email
        }
      })
    };
  }
  
  try {
    // Query games by developerId using GSI
    const params = {
      TableName: GAMES_TABLE,
      IndexName: 'developerId-index',
      KeyConditionExpression: 'developerId = :developerId',
      ExpressionAttributeValues: {
        ':developerId': developer.developerId
      }
    };
    
    console.log('Querying DynamoDB with params:', params);
    
    const result = await dynamodb.send(new QueryCommand(params));
    const games = (result.Items || []).map(transformGame);
    
    console.log(`Found ${games.length} games for developer ${developer.developerId}`);
    
    // Calculate aggregate stats
    const totalPlays = games.reduce((sum, game) => sum + (game.playCount || 0), 0);
    const totalRatings = games.reduce((sum, game) => sum + (game.ratingCount || 0), 0);
    const averageRating = totalRatings > 0 
      ? games.reduce((sum, game) => sum + (game.rating * game.ratingCount || 0), 0) / totalRatings 
      : 0;
    
    // Update developer stats in users table
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: developer.userId },
        UpdateExpression: 'SET gamesUploaded = :count, totalPlays = :plays, totalRatings = :ratings, averageRating = :avgRating',
        ExpressionAttributeValues: {
          ':count': games.length,
          ':plays': totalPlays,
          ':ratings': totalRatings,
          ':avgRating': averageRating
        }
      }));
    } catch (updateError) {
      console.log('Could not update developer stats:', updateError);
    }
    
    return {
      statusCode: 200,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: true,
        games: games,
        stats: {
          gamesCount: games.length,
          totalPlays: totalPlays,
          totalRatings: totalRatings,
          averageRating: parseFloat(averageRating.toFixed(1))
        }
      })
    };
  } catch (error) {
    console.error('Error fetching developer games:', error);
    console.error('Error details:', error.message);
    
    // Check if it's a GSI issue
    if (error.message?.includes('developerId-index')) {
      return {
        statusCode: 500,
        headers: getCorsHeaders(''),
        body: JSON.stringify({ 
          success: false,
          message: 'GSI configuration error',
          error: 'developerId-index not found or not ready'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: false,
        message: 'Failed to fetch developer games',
        error: error.message
      })
    };
  }
}

// Create game with enhanced developer authentication
async function handleCreateGame(body, authHeader) {
  console.log('🎮 DEBUG: handleCreateGame called');
  
  const developer = await getDeveloperFromToken(authHeader);
  
  if (!developer || !developer.developerId) {
    return {
      statusCode: 401,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: false,
        message: 'Unauthorized. Developer authentication required.',
        hasDeveloperId: !!developer?.developerId,
        debug: {
          hasAuth: !!developer,
          userId: developer?.userId,
          email: developer?.email
        }
      })
    };
  }
  
  try {
    const gameData = JSON.parse(body);
    
    // Required fields validation
    const requiredFields = [
      'gameId', 'name', 'description', 'category', 
      'developer', 'deviceOrientation', 'controlStyle',
      'gameStage', 'deviceCompatibility', 'gameUrl', 
      'thumbnailUrl'
    ];
    
    // Validate required fields
    for (const field of requiredFields) {
      if (!gameData[field]) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(''),
          body: JSON.stringify({ 
            success: false,
            message: `Missing required field: ${field}`,
            receivedFields: Object.keys(gameData)
          })
        };
      }
    }
    
    // Validate deviceCompatibility is an array
    if (!Array.isArray(gameData.deviceCompatibility)) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(''),
        body: JSON.stringify({ 
          success: false,
          message: 'deviceCompatibility must be an array'
        })
      };
    }
    
    // Prepare the item for DynamoDB with developer info
    const item = {
      id: gameData.gameId,
      title: gameData.name,
      description: gameData.description,
      category: gameData.category,
      genre: gameData.category,
      developerName: gameData.developer,
      developerId: developer.developerId,
      developerEmail: developer.email,
      uploadedBy: 'developer',
      deviceOrientation: gameData.deviceOrientation,
      controlStyle: gameData.controlStyle,
      gameStage: gameData.gameStage,
      deviceCompatibility: gameData.deviceCompatibility,
      buildId: gameData.buildId,
      gameUrl: gameData.gameUrl,
      trialUrl: gameData.gameUrl,
      thumbnailUrl: gameData.thumbnailUrl,
      imageUrl: gameData.thumbnailUrl,
      s3Folder: gameData.s3Folder,
      uploadedFiles: gameData.uploadedFiles || 0,
      status: gameData.status || 'active',
      publishedAt: gameData.publishedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Initialize game metrics
      playCount: 0,
      likeCount: 0,
      rating: 0,
      ratingCount: 0,
      downloads: 0,
      commentCount: 0,
      
      // Default values for mobile app compatibility
      platform: ['web', 'mobile'],
      trialType: 'webview',
      trialDuration: 5,
      price: 0,
      downloadSize: '100 MB',
      ageRating: 'everyone',
      tags: [],
      isFeatured: false,
      isNew: true,
      isTrending: false,
      
      // Display settings based on device orientation
      displaySettings: {
        preferredOrientation: gameData.deviceOrientation.toLowerCase(),
        minScreenWidth: 320,
        recommendedDevice: gameData.deviceCompatibility.includes('Computer/Laptop') ? 'any' : 'mobile'
      }
    };
    
    // Save to DynamoDB
    const params = {
      TableName: GAMES_TABLE,
      Item: item
    };
    
    console.log('🎮 DEBUG: Saving game to DynamoDB with developerId:', developer.developerId);
    
    await dynamodb.send(new PutCommand(params));
    
    console.log('✅ DEBUG: Game saved successfully by developer:', developer.companyName);
    
    return {
      statusCode: 201,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: true, 
        gameId: gameData.gameId,
        message: 'Game created successfully',
        developer: {
          id: developer.developerId,
          name: developer.companyName
        }
      })
    };
    
  } catch (error) {
    console.error('❌ Error creating game:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ 
        success: false,
        message: 'Failed to create game',
        error: error.message 
      })
    };
  }
}

// Include all other handler functions (handleGetGames, transformGame, etc.)
// ... [Rest of the functions remain the same as in games-api-fixed.js]

async function handleGetGames(queryParams) {
  const limit = parseInt(queryParams.limit) || 20;
  const nextCursor = queryParams.cursor;
  
  console.log('🎮 DEBUG: handleGetGames called with limit:', limit);
  console.log('🎮 DEBUG: GAMES_TABLE:', GAMES_TABLE);
  
  try {
    const params = {
      TableName: GAMES_TABLE,
      Limit: limit + 1 // Get one extra to check if there are more
    };
    
    if (nextCursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextCursor, 'base64').toString());
    }
    
    const result = await dynamodb.send(new ScanCommand(params));
    const items = result.Items || [];
    
    console.log('🔍 DEBUG: DynamoDB scan returned items:', items.length);
    
    const hasMore = items.length > limit;
    const games = items.slice(0, limit);
    
    // Transform to match mobile app expected format
    const transformedGames = games.map(transformGame);
    
    // Filter to only include games from trioll-prod-games-us-east-1 bucket
    const filteredGames = filterTriollGames(transformedGames);
    
    console.log(`🎮 DEBUG: Filtered ${transformedGames.length} games to ${filteredGames.length} games from trioll-prod-games bucket`);
    
    const responseBody = {
      games: filteredGames,
      hasMore: hasMore,
      nextCursor: hasMore && result.LastEvaluatedKey ? 
        Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null
    };
    
    return {
      statusCode: 200,
      headers: getCorsHeaders(''),
      body: JSON.stringify(responseBody)
    };
  } catch (error) {
    console.error('Error fetching games:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ error: 'Failed to fetch games' })
    };
  }
}

// Include other handlers...
async function handleFeaturedGames() {
  return {
    statusCode: 200,
    headers: getCorsHeaders(''),
    body: JSON.stringify({ games: [] })
  };
}

async function handleSearchGames(query) {
  return {
    statusCode: 200,
    headers: getCorsHeaders(''),
    body: JSON.stringify({ games: [] })
  };
}

async function handleGamesByCategory(category) {
  return {
    statusCode: 200,
    headers: getCorsHeaders(''),
    body: JSON.stringify({ games: [] })
  };
}

async function handleGetGameById(gameId) {
  try {
    const params = {
      TableName: GAMES_TABLE,
      Key: {
        id: gameId // Use 'id' as the partition key
      }
    };
    
    const result = await dynamodb.send(new GetCommand(params));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(''),
        body: JSON.stringify({ error: 'Game not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers: getCorsHeaders(''),
      body: JSON.stringify(transformGame(result.Item))
    };
  } catch (error) {
    console.error('Error fetching game:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(''),
      body: JSON.stringify({ error: 'Failed to fetch game' })
    };
  }
}

// Transform DynamoDB item to match mobile app expected format
function transformGame(item) {
  const GAME_ASSET_DOMAIN = 'https://dk72g9i0333mv.cloudfront.net';
  
  let platformValue = item.platform || 'both';
  if (typeof platformValue === 'string') {
    if (platformValue === 'both') {
      platformValue = ['web', 'mobile'];
    } else if (platformValue === 'mobile') {
      platformValue = ['mobile'];
    } else if (platformValue === 'web') {
      platformValue = ['web'];
    } else {
      platformValue = [platformValue];
    }
  }
  
  return {
    id: item.id,
    title: item.title || 'Untitled Game',
    developerName: item.developerName || item.developer || 'Unknown Developer',
    developerId: item.developerId || null,
    developerEmail: item.developerEmail || null,
    uploadedBy: item.uploadedBy || 'legacy',
    publisher: item.publisher || item.developerName || 'Unknown Publisher',
    rating: parseFloat(item.rating) || 0,
    ratingCount: parseInt(item.ratingCount) || 0,
    imageUrl: item.imageUrl || item.thumbnailUrl || 'https://picsum.photos/400/600',
    thumbnailUrl: item.thumbnailUrl || item.imageUrl || 'https://picsum.photos/400/600',
    coverImage: item.coverImage || item.imageUrl || 'https://picsum.photos/400/600',
    category: item.category || 'General',
    genre: item.genre || item.category || 'General',
    description: item.description || '',
    tagline: item.tagline || '',
    trialUrl: item.trialUrl || `${GAME_ASSET_DOMAIN}/${item.id}/index.html`,
    gameUrl: item.gameUrl || item.trialUrl || `${GAME_ASSET_DOMAIN}/${item.id}/index.html`,
    downloadUrl: item.downloadUrl || '',
    trialType: item.trialType || 'webview',
    videoUrl: item.videoUrl || '',
    trialDuration: parseInt(item.trialDuration) || 5,
    playCount: parseInt(item.playCount) || 0,
    likeCount: parseInt(item.likeCount) || 0,
    commentsCount: parseInt(item.commentCount || item.commentsCount) || 0,
    downloads: parseInt(item.downloads) || 0,
    price: parseFloat(item.price) || 0,
    downloadSize: item.downloadSize || '100 MB',
    platform: platformValue,
    optimizedFor: item.optimizedFor || (platformValue.includes('mobile') ? 'mobile' : 'web'),
    ageRating: item.ageRating || 'everyone',
    tags: item.tags || [],
    isFeatured: item.isFeatured || false,
    isNew: item.isNew || false,
    isTrending: item.isTrending || false,
    releaseDate: item.releaseDate || new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    displaySettings: item.displaySettings || {
      preferredOrientation: 'portrait',
      minScreenWidth: 320,
      recommendedDevice: 'mobile'
    },
    controlStyle: item.controlStyle || 'Tap & Swipe Only',
    gameStage: item.gameStage || 'Released (In App Store)',
    deviceCompatibility: item.deviceCompatibility || ['Mobile iOS', 'Mobile Android'],
    deviceOrientation: item.deviceOrientation || 'Both',
    buildId: item.buildId || null,
    s3Folder: item.s3Folder || null
  };
}