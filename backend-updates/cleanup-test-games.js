const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const GAMES_TABLE = 'trioll-prod-games';

async function cleanupTestGames() {
    console.log('Searching for test games to clean up...');
    
    try {
        // Scan for games with "Test Game Debug" in the name
        const scanParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'contains(#name, :testName) OR contains(title, :testName)',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':testName': 'Test Game Debug'
            }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
            console.log('No test games found.');
            return;
        }
        
        console.log(`Found ${scanResult.Items.length} test game records to delete:`);
        
        // Group by gameId to show unique games
        const gameIds = [...new Set(scanResult.Items.map(item => item.gameId))];
        console.log('Unique game IDs:', gameIds);
        
        // Delete each record
        for (const item of scanResult.Items) {
            console.log(`Deleting: ${item.gameId} (version: ${item.version})`);
            
            const deleteParams = {
                TableName: GAMES_TABLE,
                Key: {
                    gameId: item.gameId,
                    version: item.version
                }
            };
            
            try {
                await dynamodb.delete(deleteParams).promise();
                console.log(`✓ Deleted ${item.gameId} version ${item.version}`);
            } catch (deleteError) {
                console.error(`✗ Failed to delete ${item.gameId} version ${item.version}:`, deleteError.message);
            }
        }
        
        console.log('\nCleanup completed!');
        
        // Also check S3 for any orphaned test game folders
        console.log('\nNote: You may also want to check S3 bucket for test game folders:');
        gameIds.forEach(id => {
            console.log(`- s3://trioll-prod-games-us-east-1/${id}/`);
        });
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Run the cleanup
cleanupTestGames();