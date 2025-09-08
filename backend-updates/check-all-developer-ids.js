// Script to check all games and their developer IDs

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

const GAMES_TABLE = 'trioll-prod-games';

async function checkAllDeveloperIds() {
    console.log('🔍 Checking all games and their developer IDs');
    console.log('==========================================\n');
    
    try {
        const result = await dynamodb.send(new ScanCommand({
            TableName: GAMES_TABLE
        }));
        
        const games = result.Items || [];
        console.log(`Total games in table: ${games.length}\n`);
        
        // Group by developer ID
        const devIdGroups = {};
        let gamesWithoutDevId = 0;
        
        games.forEach(game => {
            const devId = game.developerId;
            if (devId) {
                devIdGroups[devId] = devIdGroups[devId] || [];
                devIdGroups[devId].push({
                    title: game.title || game.name || 'Untitled',
                    gameId: game.gameId,
                    version: game.version,
                    developerName: game.developerName
                });
            } else {
                gamesWithoutDevId++;
            }
        });
        
        // Display results
        console.log('📊 Developer ID Distribution:');
        console.log('============================');
        Object.entries(devIdGroups).forEach(([devId, gamesList]) => {
            console.log(`\n${devId}: ${gamesList.length} games`);
            gamesList.forEach(game => {
                console.log(`  - "${game.title}" (${game.gameId}) v${game.version || '?'}`);
            });
        });
        
        if (gamesWithoutDevId > 0) {
            console.log(`\n⚠️ Games without developer ID: ${gamesWithoutDevId}`);
        }
        
        // Check GSI count
        console.log('\n📈 GSI Analysis:');
        console.log('================');
        const gamesWithDevId = games.filter(g => g.developerId).length;
        console.log(`Games with developerId field: ${gamesWithDevId}`);
        console.log(`Games in developerId-index GSI: 7 (from AWS CLI)`);
        
        if (gamesWithDevId !== 7) {
            console.log('\n⚠️ MISMATCH: Not all games with developerId are in the GSI!');
            console.log('This might be due to:');
            console.log('1. GSI propagation delay');
            console.log('2. Games added before GSI was created');
            console.log('3. GSI needs rebuilding');
        }
        
        // Check for dev_c84a7e specifically
        console.log('\n🎯 Games for dev_c84a7e:');
        console.log('========================');
        const myGames = devIdGroups['dev_c84a7e'] || [];
        if (myGames.length > 0) {
            myGames.forEach(game => {
                console.log(`✅ "${game.title}" (${game.gameId})`);
            });
        } else {
            console.log('❌ No games found with developerId: dev_c84a7e');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the check
checkAllDeveloperIds();