# 🎮 Assign Historical Games to Freddie - Quick Lambda Solution

## One-Click Lambda Function

Copy this code and paste it into a new Lambda function in the AWS Console:

```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const GAMES_TABLE = 'trioll-prod-games';
const DEVELOPER_ID = 'dev_c84a7e';
const DEVELOPER_EMAIL = 'freddiecaplin@hotmail.com';
const DEVELOPER_NAME = 'FreddieTrioll';

exports.handler = async (event) => {
    console.log(`Assigning historical games to ${DEVELOPER_NAME} (${DEVELOPER_ID})`);
    
    try {
        // Step 1: Scan for all games without developerId
        console.log('Scanning for games without developerId...');
        const scanParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'attribute_not_exists(developerId) OR developerId = :empty',
            ExpressionAttributeValues: {
                ':empty': ''
            }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        const orphanGames = scanResult.Items || [];
        
        console.log(`Found ${orphanGames.length} games without developerId`);
        
        if (orphanGames.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No orphan games found. All games already have developer IDs.',
                    gamesUpdated: 0
                })
            };
        }
        
        // Step 2: Update each game
        console.log('Updating games...');
        const updateResults = {
            total: orphanGames.length,
            updated: [],
            failed: []
        };
        
        for (const game of orphanGames) {
            try {
                const gameId = game.id || game.gameId;
                const gameName = game.name || game.title || 'Untitled';
                
                const updateParams = {
                    TableName: GAMES_TABLE,
                    Key: { id: gameId },
                    UpdateExpression: 'SET developerId = :devId, developer = :devName, updatedAt = :timestamp',
                    ExpressionAttributeValues: {
                        ':devId': DEVELOPER_ID,
                        ':devName': DEVELOPER_NAME,
                        ':timestamp': new Date().toISOString()
                    },
                    ReturnValues: 'UPDATED_NEW'
                };
                
                await dynamodb.update(updateParams).promise();
                updateResults.updated.push(`${gameName} (${gameId})`);
                console.log(`✓ Updated: ${gameName}`);
                
            } catch (error) {
                const gameId = game.id || game.gameId;
                updateResults.failed.push(`${gameId}: ${error.message}`);
                console.error(`✗ Failed to update ${gameId}: ${error.message}`);
            }
        }
        
        // Step 3: Verify total games assigned to Freddie
        const verifyParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'developerId = :devId',
            ExpressionAttributeValues: {
                ':devId': DEVELOPER_ID
            }
        };
        
        const verifyResult = await dynamodb.scan(verifyParams).promise();
        const totalGamesForFreddie = verifyResult.Items.length;
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Historical games assignment complete!',
                results: {
                    gamesProcessed: updateResults.total,
                    successfullyUpdated: updateResults.updated.length,
                    failed: updateResults.failed.length,
                    updatedGames: updateResults.updated,
                    failedGames: updateResults.failed,
                    totalGamesNowOwnedByFreddie: totalGamesForFreddie
                }
            })
        };
        
    } catch (error) {
        console.error('Error during assignment:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};
```

## 📋 Manual Steps:

1. **Go to AWS Lambda Console**
   - https://console.aws.amazon.com/lambda/home?region=us-east-1

2. **Create New Function**
   - Click "Create function"
   - Choose "Author from scratch"
   - Function name: `trioll-assign-historical-games`
   - Runtime: Node.js 18.x
   - Use existing role: `trioll-lambda-role` (or any role with DynamoDB access)

3. **Paste the Code**
   - Replace the default code with the code above
   - Click "Deploy"

4. **Configure Settings**
   - Go to Configuration → General configuration
   - Set timeout to 5 minutes (300 seconds)
   - Set memory to 512 MB

5. **Run the Function**
   - Click "Test"
   - Create new test event with name "AssignGames"
   - Use empty JSON: `{}`
   - Click "Test" again to run

## 🎯 What This Does:

1. Finds all games without a `developerId`
2. Updates them to belong to `dev_c84a7e` (FreddieTrioll)
3. Sets the developer name to "FreddieTrioll"
4. Adds a timestamp for when the update happened
5. Returns a summary of what was updated

## ⚠️ Important Notes:

- This is a ONE-TIME operation
- It will assign ALL orphan games to Freddie's account
- Games that already have a developerId won't be touched
- After running, all historical games will appear in your "My Games" tab

## 🔄 Alternative: Test First

If you want to see what would be updated first, use this test version that only lists games:

```javascript
exports.handler = async (event) => {
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });
    
    const scanParams = {
        TableName: 'trioll-prod-games',
        FilterExpression: 'attribute_not_exists(developerId) OR developerId = :empty',
        ExpressionAttributeValues: { ':empty': '' }
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const orphanGames = result.Items || [];
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            orphanGamesCount: orphanGames.length,
            games: orphanGames.map(g => ({
                id: g.id || g.gameId,
                name: g.name || g.title || 'Untitled'
            }))
        })
    };
};
```