// Script to investigate "Untitled Game" entries

const AWS = require('aws-sdk');

// Configuration
const REGION = 'us-east-1';
const GAMES_TABLE = 'trioll-prod-games';

// Initialize AWS
AWS.config.update({ region: REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkUntitledGames() {
    console.log('🔍 Investigating "Untitled Game" entries...\n');
    
    try {
        // Scan for all games
        const scanParams = {
            TableName: GAMES_TABLE
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        const allGames = result.Items || [];
        
        console.log(`Total items in games table: ${allGames.length}\n`);
        
        // Find games without proper names
        const untitledGames = allGames.filter(game => {
            const name = game.name || game.title || '';
            return !name || name === 'Untitled Game' || name === '';
        });
        
        console.log(`Found ${untitledGames.length} games without proper titles:\n`);
        
        // Analyze each untitled game
        untitledGames.forEach((game, index) => {
            console.log(`\n═══ Untitled Game #${index + 1} ═══`);
            console.log(`GameId: ${game.gameId || game.id || 'NO ID'}`);
            console.log(`Version: ${game.version || 'NO VERSION'}`);
            console.log(`Name: ${game.name || 'NOT SET'}`);
            console.log(`Title: ${game.title || 'NOT SET'}`);
            console.log(`Developer: ${game.developer || 'NOT SET'}`);
            console.log(`DeveloperId: ${game.developerId || 'NOT SET'}`);
            console.log(`Status: ${game.status || 'NOT SET'}`);
            console.log(`GameUrl: ${game.gameUrl || 'NOT SET'}`);
            
            // Check what fields this record has
            const fields = Object.keys(game);
            console.log(`\nFields present: ${fields.join(', ')}`);
            
            // Check if it's a stats record
            if (game.version === 'v0') {
                console.log('\n⚠️  This appears to be a STATS RECORD (version: v0)');
                console.log(`Stats: plays=${game.playCount}, likes=${game.likeCount}, ratings=${game.ratingCount}`);
            }
            
            // Check for other identifying info
            if (game.uploadedAt) {
                console.log(`Uploaded: ${game.uploadedAt}`);
            }
        });
        
        // Also check for stats records (version: v0)
        console.log('\n\n📊 Checking for stats records (version: v0)...');
        const statsRecords = allGames.filter(game => game.version === 'v0');
        console.log(`Found ${statsRecords.length} stats records\n`);
        
        statsRecords.forEach(record => {
            console.log(`Stats for ${record.gameId}:`);
            console.log(`  - Plays: ${record.playCount || 0}`);
            console.log(`  - Likes: ${record.likeCount || 0}`);
            console.log(`  - Comments: ${record.commentCount || 0}`);
            console.log(`  - Rating: ${record.totalRating || 0} from ${record.ratingCount || 0} ratings`);
        });
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// Run the check
checkUntitledGames().then(() => {
    console.log('\n🏁 Check complete');
}).catch(error => {
    console.error('\n🚨 Script error:', error);
    process.exit(1);
});