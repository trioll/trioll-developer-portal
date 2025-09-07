// Script to standardize developer IDs in existing games
// This ensures all games have consistent developer identification

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';

async function standardizeDeveloperIds() {
    console.log('🔄 Starting developer ID standardization...\n');
    
    try {
        // Scan all games
        const scanResult = await dynamodb.send(new ScanCommand({
            TableName: GAMES_TABLE
        }));
        
        const games = scanResult.Items || [];
        console.log(`Found ${games.length} games to check\n`);
        
        let updated = 0;
        let skipped = 0;
        
        for (const game of games) {
            console.log(`\nChecking game: ${game.name || game.title || game.id}`);
            console.log(`  Current developer: ${game.developer}`);
            console.log(`  Current developerId: ${game.developerId}`);
            
            let needsUpdate = false;
            const updates = {};
            
            // Standardization rules for your games
            if (game.developer === 'freddiecaplin@hotmail.com' || 
                game.developer === 'FreddieTrioll' ||
                game.developer === 'Freddie Caplin') {
                
                // Standardize to your developer ID
                if (game.developerId !== 'dev_c84a7e') {
                    updates.developerId = 'dev_c84a7e';
                    needsUpdate = true;
                }
                
                // Ensure email is stored in developer field for legacy compatibility
                if (game.developer !== 'freddiecaplin@hotmail.com') {
                    updates.developer = 'freddiecaplin@hotmail.com';
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                console.log('  ✏️  Updating with:', updates);
                
                // Build update expression
                const updateParts = [];
                const expressionAttributeNames = {};
                const expressionAttributeValues = {};
                
                Object.keys(updates).forEach((key, index) => {
                    const placeholder = `:val${index}`;
                    updateParts.push(`#${key} = ${placeholder}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[placeholder] = updates[key];
                });
                
                await dynamodb.send(new UpdateCommand({
                    TableName: GAMES_TABLE,
                    Key: { id: game.id },
                    UpdateExpression: `SET ${updateParts.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues
                }));
                
                console.log('  ✅ Updated successfully');
                updated++;
            } else {
                console.log('  ⏭️  No update needed');
                skipped++;
            }
        }
        
        console.log('\n✅ Standardization complete!');
        console.log(`   Updated: ${updated} games`);
        console.log(`   Skipped: ${skipped} games`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the standardization
standardizeDeveloperIds();