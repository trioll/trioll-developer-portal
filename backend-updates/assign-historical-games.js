// Script to assign historical games to freddiecaplin@hotmail.com (dev_c84a7e)
// This updates all games without a developerId to belong to Freddie

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const GAMES_TABLE = 'trioll-prod-games';
const DEVELOPER_ID = 'dev_c84a7e';
const DEVELOPER_EMAIL = 'freddiecaplin@hotmail.com';
const DEVELOPER_NAME = 'FreddieTrioll';

async function assignHistoricalGames() {
    console.log(`Assigning historical games to ${DEVELOPER_NAME} (${DEVELOPER_ID})`);
    
    try {
        // Step 1: Scan for all games without developerId
        console.log('\n1. Scanning for games without developerId...');
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
            console.log('No orphan games found. All games already have developer IDs.');
            return;
        }
        
        // Step 2: List the games that will be updated
        console.log('\n2. Games to be assigned to Freddie:');
        orphanGames.forEach((game, index) => {
            console.log(`   ${index + 1}. ${game.name || game.title || 'Untitled'} (ID: ${game.id || game.gameId})`);
        });
        
        // Step 3: Update each game with Freddie's developerId
        console.log('\n3. Updating games...');
        let successCount = 0;
        let failCount = 0;
        
        for (const game of orphanGames) {
            try {
                const gameId = game.id || game.gameId;
                
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
                console.log(`   ✓ Updated: ${game.name || game.title || gameId}`);
                successCount++;
                
            } catch (error) {
                console.error(`   ✗ Failed to update ${game.id || game.gameId}: ${error.message}`);
                failCount++;
            }
        }
        
        // Step 4: Summary
        console.log('\n4. Update Summary:');
        console.log(`   Total games processed: ${orphanGames.length}`);
        console.log(`   Successfully updated: ${successCount}`);
        console.log(`   Failed updates: ${failCount}`);
        
        // Step 5: Verify the update
        console.log('\n5. Verifying updates...');
        const verifyParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'developerId = :devId',
            ExpressionAttributeValues: {
                ':devId': DEVELOPER_ID
            }
        };
        
        const verifyResult = await dynamodb.scan(verifyParams).promise();
        console.log(`\nTotal games now assigned to ${DEVELOPER_NAME}: ${verifyResult.Items.length}`);
        
        console.log('\n✅ Historical games assignment complete!');
        
    } catch (error) {
        console.error('Error during assignment:', error);
        throw error;
    }
}

// Add option to assign specific games by ID
async function assignSpecificGames(gameIds) {
    console.log(`\nAssigning specific games to ${DEVELOPER_NAME}...`);
    
    for (const gameId of gameIds) {
        try {
            const updateParams = {
                TableName: GAMES_TABLE,
                Key: { id: gameId },
                UpdateExpression: 'SET developerId = :devId, developer = :devName, updatedAt = :timestamp',
                ExpressionAttributeValues: {
                    ':devId': DEVELOPER_ID,
                    ':devName': DEVELOPER_NAME,
                    ':timestamp': new Date().toISOString()
                },
                ReturnValues: 'ALL_NEW'
            };
            
            const result = await dynamodb.update(updateParams).promise();
            console.log(`✓ Updated ${gameId}: ${result.Attributes.name || result.Attributes.title}`);
            
        } catch (error) {
            console.error(`✗ Failed to update ${gameId}: ${error.message}`);
        }
    }
}

// Execute based on command line arguments
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === '--specific') {
        // Update specific games by ID
        const gameIds = args.slice(1);
        if (gameIds.length === 0) {
            console.error('Please provide game IDs after --specific flag');
            process.exit(1);
        }
        assignSpecificGames(gameIds)
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    } else {
        // Update all orphan games
        assignHistoricalGames()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    }
}

module.exports = { assignHistoricalGames, assignSpecificGames };