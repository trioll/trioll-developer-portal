const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS with environment variable support
AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const COMMENTS_TABLE = process.env.COMMENTS_TABLE || 'trioll-prod-comments';
const GAMES_TABLE = process.env.GAMES_TABLE || 'trioll-prod-games';
const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Mode',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

// Helper to extract user info from token
const getUserInfo = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Handle guest tokens
    if (token.startsWith('guest-')) {
        return {
            userId: token.replace('guest-', ''),
            userName: 'Guest Player',
            isGuest: true
        };
    }
    
    // Decode JWT
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        return {
            userId: decoded.sub || decoded['cognito:username'],
            email: decoded.email,
            userName: decoded.preferred_username || decoded.name || 'Player',
            isGuest: false
        };
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};

// Get comments for a game
exports.getComments = async (event) => {
    const gameId = event.pathParameters?.gameId;
    const limit = parseInt(event.queryStringParameters?.limit) || 20;
    const lastKey = event.queryStringParameters?.lastKey;
    
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
    
    try {
        const params = {
            TableName: COMMENTS_TABLE,
            KeyConditionExpression: 'gameId = :gameId',
            ExpressionAttributeValues: {
                ':gameId': gameId
            },
            ScanIndexForward: false, // Newest first
            Limit: limit
        };
        
        if (lastKey) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        }
        
        const result = await dynamodb.query(params).promise();
        
        // Format the response
        const response = {
            success: true,
            comments: result.Items || [],
            count: result.Count
        };
        
        // Add pagination key if there are more results
        if (result.LastEvaluatedKey) {
            response.nextKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        console.error('Get comments error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to fetch comments'
            })
        };
    }
};

// Post a new comment
exports.postComment = async (event) => {
    const gameId = event.pathParameters?.gameId;
    const body = JSON.parse(event.body || '{}');
    const userInfo = getUserInfo(event.headers.Authorization);
    
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
    
    if (!userInfo) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Authentication required to post comments'
            })
        };
    }
    
    if (!body.comment || body.comment.trim().length === 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Comment text is required'
            })
        };
    }
    
    try {
        // Create comment
        const timestamp = new Date().toISOString();
        const comment = {
            gameId,
            commentId: `comment_${Date.now()}_${uuidv4().substring(0, 8)}`,
            userId: userInfo.userId,
            userName: body.userName || userInfo.userName,
            userAvatar: body.userAvatar || null,
            comment: body.comment.trim(),
            rating: body.rating || null, // 1-5 star rating if provided
            createdAt: timestamp,
            updatedAt: timestamp,
            likes: 0,
            isEdited: false,
            isGuest: userInfo.isGuest || false,
            parentCommentId: body.parentCommentId || null // For replies
        };
        
        // Save comment
        await dynamodb.put({
            TableName: COMMENTS_TABLE,
            Item: comment
        }).promise();
        
        // Update game's comment count
        await dynamodb.update({
            TableName: GAMES_TABLE,
            Key: { gameId },
            UpdateExpression: 'ADD commentCount :inc SET lastCommentAt = :now',
            ExpressionAttributeValues: {
                ':inc': 1,
                ':now': timestamp
            }
        }).promise();
        
        // If rating was provided, update game rating
        if (body.rating && body.rating >= 1 && body.rating <= 5) {
            await updateGameRating(gameId, body.rating);
        }
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Comment posted successfully',
                comment
            })
        };
        
    } catch (error) {
        console.error('Post comment error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to post comment'
            })
        };
    }
};

// Update a comment (edit)
exports.updateComment = async (event) => {
    const commentId = event.pathParameters?.commentId;
    const body = JSON.parse(event.body || '{}');
    const userInfo = getUserInfo(event.headers.Authorization);
    
    if (!commentId || !body.comment) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Comment ID and text are required'
            })
        };
    }
    
    if (!userInfo) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Authentication required'
            })
        };
    }
    
    try {
        // First get the comment to verify ownership
        const existing = await dynamodb.scan({
            TableName: COMMENTS_TABLE,
            FilterExpression: 'commentId = :cid',
            ExpressionAttributeValues: {
                ':cid': commentId
            }
        }).promise();
        
        if (!existing.Items || existing.Items.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Comment not found'
                })
            };
        }
        
        const existingComment = existing.Items[0];
        
        // Verify ownership
        if (existingComment.userId !== userInfo.userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'You can only edit your own comments'
                })
            };
        }
        
        // Update comment
        await dynamodb.update({
            TableName: COMMENTS_TABLE,
            Key: {
                gameId: existingComment.gameId,
                commentId: commentId
            },
            UpdateExpression: 'SET #comment = :comment, updatedAt = :now, isEdited = :true',
            ExpressionAttributeNames: {
                '#comment': 'comment'
            },
            ExpressionAttributeValues: {
                ':comment': body.comment.trim(),
                ':now': new Date().toISOString(),
                ':true': true
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Comment updated successfully'
            })
        };
        
    } catch (error) {
        console.error('Update comment error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to update comment'
            })
        };
    }
};

// Delete a comment
exports.deleteComment = async (event) => {
    const commentId = event.pathParameters?.commentId;
    const userInfo = getUserInfo(event.headers.Authorization);
    
    if (!commentId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Comment ID is required'
            })
        };
    }
    
    if (!userInfo) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Authentication required'
            })
        };
    }
    
    try {
        // First get the comment to verify ownership and get gameId
        const existing = await dynamodb.scan({
            TableName: COMMENTS_TABLE,
            FilterExpression: 'commentId = :cid',
            ExpressionAttributeValues: {
                ':cid': commentId
            }
        }).promise();
        
        if (!existing.Items || existing.Items.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Comment not found'
                })
            };
        }
        
        const existingComment = existing.Items[0];
        
        // Verify ownership (allow developers to delete any comment on their games)
        const isDeveloper = await checkIfDeveloper(userInfo.email, existingComment.gameId);
        if (existingComment.userId !== userInfo.userId && !isDeveloper) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'You can only delete your own comments'
                })
            };
        }
        
        // Delete comment
        await dynamodb.delete({
            TableName: COMMENTS_TABLE,
            Key: {
                gameId: existingComment.gameId,
                commentId: commentId
            }
        }).promise();
        
        // Update game's comment count
        await dynamodb.update({
            TableName: GAMES_TABLE,
            Key: { gameId: existingComment.gameId },
            UpdateExpression: 'ADD commentCount :dec',
            ExpressionAttributeValues: {
                ':dec': -1
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Comment deleted successfully'
            })
        };
        
    } catch (error) {
        console.error('Delete comment error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to delete comment'
            })
        };
    }
};

// Like a comment
exports.likeComment = async (event) => {
    const commentId = event.pathParameters?.commentId;
    const userInfo = getUserInfo(event.headers.Authorization);
    
    if (!commentId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Comment ID is required'
            })
        };
    }
    
    try {
        // Find the comment
        const existing = await dynamodb.scan({
            TableName: COMMENTS_TABLE,
            FilterExpression: 'commentId = :cid',
            ExpressionAttributeValues: {
                ':cid': commentId
            }
        }).promise();
        
        if (!existing.Items || existing.Items.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Comment not found'
                })
            };
        }
        
        const comment = existing.Items[0];
        
        // Increment likes
        await dynamodb.update({
            TableName: COMMENTS_TABLE,
            Key: {
                gameId: comment.gameId,
                commentId: commentId
            },
            UpdateExpression: 'ADD likes :inc',
            ExpressionAttributeValues: {
                ':inc': 1
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Comment liked'
            })
        };
        
    } catch (error) {
        console.error('Like comment error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to like comment'
            })
        };
    }
};

// Helper function to update game rating
async function updateGameRating(gameId, newRating) {
    try {
        // Get current game stats
        const game = await dynamodb.get({
            TableName: GAMES_TABLE,
            Key: { gameId }
        }).promise();
        
        if (!game.Item) return;
        
        const currentRatingSum = (game.Item.ratingSum || 0);
        const currentRatingCount = (game.Item.ratingCount || 0);
        
        // Calculate new average
        const newRatingSum = currentRatingSum + newRating;
        const newRatingCount = currentRatingCount + 1;
        const newAverage = newRatingSum / newRatingCount;
        
        // Update game
        await dynamodb.update({
            TableName: GAMES_TABLE,
            Key: { gameId },
            UpdateExpression: 'SET rating = :avg, ratingSum = :sum, ratingCount = :count',
            ExpressionAttributeValues: {
                ':avg': Math.round(newAverage * 10) / 10, // Round to 1 decimal
                ':sum': newRatingSum,
                ':count': newRatingCount
            }
        }).promise();
    } catch (error) {
        console.error('Update rating error:', error);
    }
}

// Helper function to check if user is the developer of a game
async function checkIfDeveloper(userEmail, gameId) {
    if (!userEmail || !gameId) return false;
    
    try {
        const game = await dynamodb.get({
            TableName: GAMES_TABLE,
            Key: { gameId }
        }).promise();
        
        if (game.Item && game.Item.developerEmail === userEmail) {
            return true;
        }
    } catch (error) {
        console.error('Check developer error:', error);
    }
    
    return false;
}

// Main handler
exports.handler = async (event) => {
    const method = event.httpMethod;
    const path = event.path;
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        // Route to appropriate handler
        if (path.includes('/comments') && path.includes('/games/')) {
            if (method === 'GET') {
                return await exports.getComments(event);
            } else if (method === 'POST') {
                return await exports.postComment(event);
            }
        } else if (path.includes('/comments/') && method === 'PUT') {
            if (path.endsWith('/like')) {
                return await exports.likeComment(event);
            } else {
                return await exports.updateComment(event);
            }
        } else if (path.includes('/comments/') && method === 'DELETE') {
            return await exports.deleteComment(event);
        }
        
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