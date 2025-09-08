// Script to fix developer IDs in existing games
// This will update games that have incorrect developer IDs

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';

// Mapping of old developer IDs to new standardized IDs
const DEVELOPER_MAPPING = {
    'FreddieTrioll': 'dev_c84a7e',
    'freddiecaplin@hotmail.com': 'dev_c84a7e',
    'Freddie': 'dev_c84a7e',
    'freddie': 'dev_c84a7e',
    // Add more mappings as needed
};

async function fixDeveloperIds() {
    console.log('🔧 Starting Developer ID Fix');
    console.log('================================\n');
    
    try {
        // Scan for all games
        console.log('Scanning games table...');
        const scanResult = await dynamodb.send(new ScanCommand({
            TableName: GAMES_TABLE
        }));
        
        const games = scanResult.Items || [];
        console.log(`Found ${games.length} total games\n`);
        
        let fixedCount = 0;
        let errorCount = 0;
        
        // Process each game
        for (const game of games) {
            const currentDevId = game.developerId;
            const gameTitle = game.title || game.name || 'Untitled';
            
            // Check if this developer ID needs fixing
            if (DEVELOPER_MAPPING[currentDevId]) {
                const newDevId = DEVELOPER_MAPPING[currentDevId];
                console.log(`📝 Updating "${gameTitle}" (${game.gameId})`);
                console.log(`   Old ID: ${currentDevId} → New ID: ${newDevId}`);
                
                try {
                    // Update the game
                    await dynamodb.send(new UpdateCommand({
                        TableName: GAMES_TABLE,
                        Key: {
                            gameId: game.gameId,
                            version: game.version || '1.0.0'
                        },
                        UpdateExpression: 'SET developerId = :newId, updatedAt = :timestamp',
                        ExpressionAttributeValues: {
                            ':newId': newDevId,
                            ':timestamp': new Date().toISOString()
                        }
                    }));
                    
                    console.log(`   ✅ Updated successfully\n`);
                    fixedCount++;
                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}\n`);
                    errorCount++;
                }
            } else if (currentDevId && currentDevId.startsWith('dev_')) {
                // Already has correct format
                console.log(`✓ "${gameTitle}" already has correct ID: ${currentDevId}`);
            } else if (!currentDevId) {
                console.log(`⚠️  "${gameTitle}" has no developer ID`);
            } else {
                console.log(`❓ "${gameTitle}" has unknown developer ID: ${currentDevId}`);
            }
        }
        
        console.log('\n=============================');
        console.log('📊 Summary:');
        console.log(`   Total games: ${games.length}`);
        console.log(`   Fixed: ${fixedCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Already correct: ${games.length - fixedCount - errorCount}`);
        
        if (fixedCount > 0) {
            console.log('\n✅ Developer IDs updated successfully!');
            console.log('   Your games should now appear in the "My Games" tab');
        }
        
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Add command line support for specific games
async function fixSpecificGames(gameIds) {
    console.log(`🔧 Fixing specific games: ${gameIds.join(', ')}`);
    
    for (const gameId of gameIds) {
        try {
            // For specific games, just set to dev_c84a7e
            await dynamodb.send(new UpdateCommand({
                TableName: GAMES_TABLE,
                Key: {
                    gameId: gameId,
                    version: '1.0.0'
                },
                UpdateExpression: 'SET developerId = :newId, updatedAt = :timestamp',
                ExpressionAttributeValues: {
                    ':newId': 'dev_c84a7e',
                    ':timestamp': new Date().toISOString()
                }
            }));
            
            console.log(`✅ Updated ${gameId}`);
        } catch (error) {
            console.log(`❌ Error updating ${gameId}: ${error.message}`);
        }
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === '--games') {
        // Fix specific games
        const gameIds = args.slice(1);
        if (gameIds.length === 0) {
            console.error('Please provide game IDs after --games flag');
            console.log('Example: node fix-developer-ids.js --games Evolution-Runner Platform-Jumper');
            process.exit(1);
        }
        fixSpecificGames(gameIds);
    } else {
        // Fix all games
        fixDeveloperIds();
    }
}