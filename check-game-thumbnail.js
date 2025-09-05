// Script to check if a game has a thumbnail

const AWS = require('aws-sdk');

// Configuration
const REGION = 'us-east-1';
const GAMES_TABLE = 'trioll-prod-games';
const GAMES_BUCKET = 'trioll-prod-games-us-east-1';

// Initialize AWS
AWS.config.update({ region: REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

async function checkGameThumbnail(gameId) {
    console.log(`🔍 Checking thumbnail for game: ${gameId}`);
    
    try {
        // Step 1: Get game data from DynamoDB
        console.log('\n1️⃣ Fetching game data from DynamoDB...');
        
        const params = {
            TableName: GAMES_TABLE,
            Key: {
                gameId: gameId,
                version: '1.0.0'
            }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (!result.Item) {
            console.log('❌ Game not found in database');
            return;
        }
        
        const game = result.Item;
        console.log(`✅ Found game: ${game.name || game.title}`);
        console.log(`   Developer: ${game.developer} (${game.developerId})`);
        
        // Check thumbnail fields
        console.log('\n2️⃣ Checking thumbnail fields:');
        console.log(`   thumbnailUrl: ${game.thumbnailUrl || '❌ Not set'}`);
        console.log(`   imageUrl: ${game.imageUrl || '❌ Not set'}`);
        console.log(`   coverImageUrl: ${game.coverImageUrl || '❌ Not set'}`);
        
        // Step 2: Check S3 for common thumbnail files
        console.log('\n3️⃣ Checking S3 for thumbnail files...');
        
        const listParams = {
            Bucket: GAMES_BUCKET,
            Prefix: `${gameId}/`,
            MaxKeys: 100
        };
        
        const s3Result = await s3.listObjectsV2(listParams).promise();
        
        if (s3Result.Contents && s3Result.Contents.length > 0) {
            console.log(`✅ Found ${s3Result.Contents.length} files in S3:`);
            
            const thumbnailFiles = s3Result.Contents.filter(obj => 
                obj.Key.toLowerCase().includes('thumb') || 
                obj.Key.toLowerCase().includes('image') ||
                obj.Key.toLowerCase().includes('cover') ||
                obj.Key.match(/\.(png|jpg|jpeg|gif|svg)$/i)
            );
            
            if (thumbnailFiles.length > 0) {
                console.log('\n📸 Potential thumbnail files:');
                thumbnailFiles.forEach(file => {
                    const url = `https://dgq2nqysbn2z3.cloudfront.net/${file.Key}`;
                    console.log(`   - ${file.Key}`);
                    console.log(`     URL: ${url}`);
                    console.log(`     Size: ${file.Size} bytes`);
                });
            } else {
                console.log('❌ No thumbnail files found in S3');
            }
            
            console.log('\n📁 All files in game folder:');
            s3Result.Contents.forEach(file => {
                console.log(`   - ${file.Key} (${file.Size} bytes)`);
            });
        } else {
            console.log('❌ No files found in S3 for this game');
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// Check Zombie Survival
checkGameThumbnail('zombie-survival-1751897800105').then(() => {
    console.log('\n🏁 Check complete');
}).catch(error => {
    console.error('\n🚨 Script error:', error);
    process.exit(1);
});