// Patch to add to existing games-api.js Lambda function
// This adds developer ID support to game creation

// Add this to the POST /games handler
exports.createGameWithDeveloper = async (gameData, authToken) => {
    const jwt = require('jsonwebtoken');
    let developerId = gameData.developerId;
    let developerEmail;
    
    if (authToken) {
        const decoded = jwt.decode(authToken);
        developerEmail = decoded.email || decoded['cognito:username'];
        
        // Get developer info from users table if not provided
        if (!developerId && developerEmail) {
            const userData = await dynamodb.get({
                TableName: 'trioll-prod-users',
                Key: { email: developerEmail }
            }).promise();
            
            if (userData.Item) {
                developerId = userData.Item.developerId;
            }
        }
    }
    
    // Add developer fields to game object
    const enhancedGameData = {
        ...gameData,
        developerId: developerId || null,
        developerEmail: developerEmail || null
    };
    
    // Update developer's game count if we have their ID
    if (developerId && developerEmail) {
        await dynamodb.update({
            TableName: 'trioll-prod-users',
            Key: { email: developerEmail },
            UpdateExpression: 'ADD gamesCount :inc SET updatedAt = :now',
            ExpressionAttributeValues: {
                ':inc': 1,
                ':now': new Date().toISOString()
            }
        }).promise();
    }
    
    return enhancedGameData;
};

// Add this endpoint handler for /developers/games
exports.getDeveloperGames = async (event) => {
    try {
        // Extract developer email from token
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
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        const email = decoded.email || decoded['cognito:username'];
        
        // Get developer info
        const userData = await dynamodb.get({
            TableName: 'trioll-prod-users',
            Key: { email }
        }).promise();
        
        if (!userData.Item || !userData.Item.developerId) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Developer not found',
                    games: []
                })
            };
        }
        
        const developerId = userData.Item.developerId;
        
        // Query games by developerId using existing GSI
        const params = {
            TableName: 'trioll-prod-games',
            IndexName: 'developerId-index',
            KeyConditionExpression: 'developerId = :devId',
            ExpressionAttributeValues: {
                ':devId': developerId
            }
        };
        
        const result = await dynamodb.query(params).promise();
        const games = result.Items || [];
        
        // Calculate stats
        const stats = {
            totalGames: games.length,
            totalPlays: games.reduce((sum, game) => sum + (game.playCount || 0), 0),
            totalLikes: games.reduce((sum, game) => sum + (game.likeCount || 0), 0),
            averageRating: games.length > 0 
                ? games.reduce((sum, game) => sum + (game.rating || 0), 0) / games.length 
                : 0
        };
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                developer: {
                    developerId,
                    companyName: userData.Item.companyName,
                    email: userData.Item.email
                },
                games: games.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
                stats
            })
        };
        
    } catch (error) {
        console.error('Get developer games error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to fetch developer games',
                games: [],
                stats: {}
            })
        };
    }
};