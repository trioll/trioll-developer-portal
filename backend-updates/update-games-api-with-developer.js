const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const GAMES_TABLE = process.env.GAMES_TABLE || 'trioll-prod-games';
const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';

// Create new game with developer ID
exports.createGame = async (event) => {
    try {
        const gameData = JSON.parse(event.body);
        
        // Extract developer info from auth token or request
        const token = event.headers.Authorization?.replace('Bearer ', '');
        let developerId = gameData.developerId;
        let developerEmail;
        
        if (token) {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            developerEmail = decoded.email || decoded['cognito:username'];
            
            // Get developer info from users table if not provided
            if (!developerId && developerEmail) {
                const userData = await dynamodb.get({
                    TableName: USERS_TABLE,
                    Key: { email: developerEmail }
                }).promise();
                
                if (userData.Item) {
                    developerId = userData.Item.developerId;
                }
            }
        }
        
        const timestamp = new Date().toISOString();
        const gameId = gameData.gameId || uuidv4();
        
        const game = {
            gameId,
            name: gameData.name,
            category: gameData.category || 'action',
            description: gameData.description || '',
            developer: gameData.developer || 'Unknown Developer',
            developerId: developerId || null,
            developerEmail: developerEmail || null,
            thumbnailUrl: gameData.thumbnailUrl || '',
            gameUrl: gameData.gameUrl || '',
            s3Folder: gameData.s3Folder || gameId,
            buildId: gameData.buildId,
            deviceOrientation: gameData.deviceOrientation || 'both',
            controlStyle: gameData.controlStyle || 'touchscreen',
            gameStage: gameData.gameStage || 'beta',
            deviceCompatibility: gameData.deviceCompatibility || ['all'],
            createdAt: timestamp,
            updatedAt: timestamp,
            isActive: true,
            playCount: 0,
            likeCount: 0,
            rating: 0,
            ratingCount: 0
        };
        
        await dynamodb.put({
            TableName: GAMES_TABLE,
            Item: game
        }).promise();
        
        // Update developer's game count if we have their ID
        if (developerId && developerEmail) {
            await dynamodb.update({
                TableName: USERS_TABLE,
                Key: { email: developerEmail },
                UpdateExpression: 'ADD gamesCount :inc SET updatedAt = :now',
                ExpressionAttributeValues: {
                    ':inc': 1,
                    ':now': timestamp
                }
            }).promise();
        }
        
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                game
            })
        };
    } catch (error) {
        console.error('Create game error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to create game'
            })
        };
    }
};

// Get games (with optional developer filter)
exports.getGames = async (event) => {
    try {
        // Check if filtering by developer
        const developerId = event.queryStringParameters?.developerId;
        
        let params = {
            TableName: GAMES_TABLE
        };
        
        if (developerId) {
            // Use GSI to query by developerId
            params.IndexName = 'developerId-index';
            params.KeyConditionExpression = 'developerId = :devId';
            params.ExpressionAttributeValues = {
                ':devId': developerId
            };
        }
        
        let games = [];
        
        if (developerId) {
            // Query using GSI
            const result = await dynamodb.query(params).promise();
            games = result.Items || [];
        } else {
            // Scan all games
            const result = await dynamodb.scan(params).promise();
            games = result.Items || [];
        }
        
        // Filter only active games and sort by creation date
        games = games
            .filter(game => game.isActive !== false)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                games,
                count: games.length
            })
        };
    } catch (error) {
        console.error('Get games error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Failed to fetch games',
                games: []
            })
        };
    }
};

// Get developer's games
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
            TableName: USERS_TABLE,
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
        
        // Query games by developerId using GSI
        const params = {
            TableName: GAMES_TABLE,
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

// Update the main handler to include new endpoints
exports.handler = async (event) => {
    const path = event.path;
    const method = event.httpMethod;
    
    console.log('Games API request:', method, path);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }
    
    try {
        if (path === '/games' && method === 'GET') {
            return await exports.getGames(event);
        } else if (path === '/games' && method === 'POST') {
            return await exports.createGame(event);
        } else if (path === '/developers/games' && method === 'GET') {
            return await exports.getDeveloperGames(event);
        } else {
            // Handle other existing endpoints...
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Endpoint not found'
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
                message: 'Internal server error'
            })
        };
    }
};