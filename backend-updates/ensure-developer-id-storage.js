// Patch for games-api Lambda to ensure developer ID is stored

// Add this to the POST /games handler to ensure all fields are saved
exports.createGameWithAllFields = async (event) => {
    const gameData = JSON.parse(event.body);
    const authToken = event.headers.Authorization?.replace('Bearer ', '');
    
    // Extract developer email from token if available
    let developerEmail;
    if (authToken) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(authToken);
            developerEmail = decoded.email || decoded['cognito:username'];
        } catch (e) {
            console.log('Could not decode token:', e);
        }
    }
    
    // Ensure we have all the fields
    const timestamp = new Date().toISOString();
    const completeGameData = {
        gameId: gameData.gameId || `game_${Date.now()}`,
        // Basic info
        name: gameData.name || gameData.title,
        title: gameData.title || gameData.name,
        category: gameData.category || 'uncategorized',
        description: gameData.description || '',
        
        // Developer info
        developer: gameData.developer || 'Unknown Developer',
        developerId: gameData.developerId || null,
        developerEmail: developerEmail || null,
        
        // Game settings
        deviceOrientation: gameData.deviceOrientation || 'both',
        controlStyle: gameData.controlStyle || 'touchscreen',
        gameStage: gameData.gameStage || 'beta',
        deviceCompatibility: gameData.deviceCompatibility || ['all'],
        buildId: gameData.buildId || null,
        
        // URLs and files
        gameUrl: gameData.gameUrl || '',
        thumbnailUrl: gameData.thumbnailUrl || '',
        s3Folder: gameData.s3Folder || gameData.gameId,
        uploadedFiles: gameData.uploadedFiles || 0,
        
        // Timestamps
        createdAt: timestamp,
        updatedAt: timestamp,
        uploadedAt: gameData.uploadedAt || timestamp,
        publishedAt: gameData.publishedAt || timestamp,
        
        // Status and stats
        status: gameData.status || 'active',
        isActive: true,
        plays: gameData.plays || 0,
        likes: gameData.likes || 0,
        rating: gameData.rating || 0,
        playCount: 0,
        likeCount: 0,
        ratingCount: 0,
        commentCount: 0,
        
        // Version for DynamoDB GSI
        version: 'v1'
    };
    
    // Save to DynamoDB
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    await dynamodb.put({
        TableName: process.env.GAMES_TABLE || 'trioll-prod-games',
        Item: completeGameData
    }).promise();
    
    // Update developer's game count if we have their ID and email
    if (gameData.developerId && developerEmail) {
        try {
            await dynamodb.update({
                TableName: process.env.USERS_TABLE || 'trioll-prod-users',
                Key: { email: developerEmail },
                UpdateExpression: 'ADD gamesCount :inc SET updatedAt = :now',
                ExpressionAttributeValues: {
                    ':inc': 1,
                    ':now': timestamp
                },
                ConditionExpression: 'attribute_exists(email)'
            }).promise();
        } catch (e) {
            console.log('Could not update developer game count:', e);
        }
    }
    
    return {
        statusCode: 201,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            success: true,
            message: 'Game created successfully',
            gameId: completeGameData.gameId,
            game: completeGameData
        })
    };
};