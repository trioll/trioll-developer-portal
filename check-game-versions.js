// Quick script to check what version values games actually have

const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkVersions() {
    console.log('Checking version values in games table...\n');
    
    const result = await dynamodb.scan({
        TableName: 'trioll-prod-games'
    }).promise();
    
    const items = result.Items || [];
    
    // Group by version
    const versionGroups = {};
    items.forEach(item => {
        const version = item.version || 'NO_VERSION';
        if (!versionGroups[version]) {
            versionGroups[version] = [];
        }
        versionGroups[version].push(item);
    });
    
    // Show what we found
    Object.keys(versionGroups).forEach(version => {
        const games = versionGroups[version];
        console.log(`\nVersion "${version}": ${games.length} items`);
        
        if (games.length <= 3) {
            games.forEach(game => {
                console.log(`  - ${game.name || game.title || 'NO_NAME'} (${game.gameId})`);
            });
        } else {
            // Show first 3
            games.slice(0, 3).forEach(game => {
                console.log(`  - ${game.name || game.title || 'NO_NAME'} (${game.gameId})`);
            });
            console.log(`  ... and ${games.length - 3} more`);
        }
    });
    
    // Check if any actual games don't have version
    console.log('\n\nChecking games without version field:');
    const noVersion = items.filter(item => !item.version && (item.name || item.title));
    noVersion.forEach(game => {
        console.log(`  - ${game.name || game.title} (${game.gameId}) - Has content: ${!!game.gameUrl}`);
    });
}

checkVersions().catch(console.error);