import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';
const DEVELOPER_ID = 'dev_c84a7e';
const DEVELOPER_EMAIL = 'freddiecaplin@hotmail.com';
const DEVELOPER_NAME = 'FreddieTrioll';

export const handler = async (event) => {
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
        
        const scanResult = await dynamodb.send(new ScanCommand(scanParams));
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
                
                await dynamodb.send(new UpdateCommand(updateParams));
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
        
        const verifyResult = await dynamodb.send(new ScanCommand(verifyParams));
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