// Script to add thumbnail to existing Horror Pong game

const AWS = require('aws-sdk');
const fs = require('fs');

// Configuration
const REGION = 'us-east-1';
const GAMES_BUCKET = 'trioll-prod-games-us-east-1';
const GAMES_TABLE = 'trioll-prod-games';
const GAME_ID = 'horror-pong-1757087555176';

// Initialize AWS
AWS.config.update({ region: REGION });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Create a simple SVG thumbnail since we can't generate PNG directly
const thumbnailSVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <!-- Black background -->
  <rect width="400" height="300" fill="#000000"/>
  
  <!-- Title -->
  <text x="200" y="50" font-family="monospace" font-size="36" fill="#ff0000" text-anchor="middle" font-weight="bold">HORROR PONG</text>
  <text x="200" y="80" font-family="monospace" font-size="48" fill="#ff0000" text-anchor="middle">👻</text>
  
  <!-- Game preview -->
  <!-- Left paddle -->
  <rect x="30" y="120" width="10" height="80" fill="#00ff00"/>
  
  <!-- Right paddle -->
  <rect x="360" y="140" width="10" height="80" fill="#00ff00"/>
  
  <!-- Ball with glow effect -->
  <circle cx="200" cy="170" r="8" fill="#ff0000" opacity="0.8"/>
  <circle cx="200" cy="170" r="12" fill="#ff0000" opacity="0.4"/>
  <circle cx="200" cy="170" r="16" fill="#ff0000" opacity="0.2"/>
  
  <!-- Score -->
  <text x="150" y="120" font-family="monospace" font-size="24" fill="#ff0000">13</text>
  <text x="250" y="120" font-family="monospace" font-size="24" fill="#ff0000">7</text>
  
  <!-- Blood drops effect -->
  <circle cx="180" cy="180" r="2" fill="#ff0000" opacity="0.6"/>
  <ellipse cx="180" cy="185" rx="2" ry="4" fill="#ff0000" opacity="0.5"/>
  <circle cx="220" cy="160" r="2" fill="#ff0000" opacity="0.7"/>
  <ellipse cx="220" cy="165" rx="2" ry="4" fill="#ff0000" opacity="0.6"/>
  
  <!-- Creepy text at bottom -->
  <text x="200" y="270" font-family="monospace" font-size="16" fill="#00ff00" text-anchor="middle" opacity="0.7">THERE IS NO ESCAPE</text>
  
  <!-- Border glow effect -->
  <rect x="2" y="2" width="396" height="296" fill="none" stroke="#ff0000" stroke-width="2" opacity="0.3"/>
</svg>`;

// Also create a simple HTML file that displays as a thumbnail
const thumbnailHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: monospace;
            overflow: hidden;
        }
        .thumbnail {
            text-align: center;
            color: #f00;
            position: relative;
        }
        h1 {
            font-size: 48px;
            margin: 0;
            text-shadow: 0 0 20px #f00;
            animation: flicker 2s infinite;
        }
        .ghost {
            font-size: 80px;
            margin: 20px;
            filter: drop-shadow(0 0 20px #f00);
        }
        .game-preview {
            width: 300px;
            height: 150px;
            border: 2px solid #0f0;
            position: relative;
            margin: 20px auto;
            box-shadow: 0 0 30px #0f0;
        }
        .paddle {
            position: absolute;
            width: 10px;
            height: 60px;
            background: #0f0;
        }
        .ball {
            position: absolute;
            width: 15px;
            height: 15px;
            background: #f00;
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 20px #f00;
        }
        @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
    </style>
</head>
<body>
    <div class="thumbnail">
        <h1>HORROR PONG</h1>
        <div class="ghost">👻</div>
        <div class="game-preview">
            <div class="paddle" style="left: 10px; top: 45px;"></div>
            <div class="paddle" style="right: 10px; top: 45px;"></div>
            <div class="ball"></div>
        </div>
    </div>
</body>
</html>`;

async function uploadThumbnail() {
    console.log('📸 Uploading thumbnail for Horror Pong...');
    
    try {
        // Upload SVG thumbnail
        const svgKey = `${GAME_ID}/thumbnail.svg`;
        console.log('\n1️⃣ Uploading SVG thumbnail...');
        
        const svgParams = {
            Bucket: GAMES_BUCKET,
            Key: svgKey,
            Body: thumbnailSVG,
            ContentType: 'image/svg+xml'
        };
        
        const svgResult = await s3.upload(svgParams).promise();
        console.log('✅ SVG thumbnail uploaded!');
        console.log(`   Location: ${svgResult.Location}`);
        
        // Upload HTML thumbnail (as backup)
        const htmlKey = `${GAME_ID}/thumbnail.html`;
        console.log('\n2️⃣ Uploading HTML thumbnail...');
        
        const htmlParams = {
            Bucket: GAMES_BUCKET,
            Key: htmlKey,
            Body: thumbnailHTML,
            ContentType: 'text/html'
        };
        
        const htmlResult = await s3.upload(htmlParams).promise();
        console.log('✅ HTML thumbnail uploaded!');
        
        // Update DynamoDB with thumbnail URL
        const thumbnailUrl = `https://dgq2nqysbn2z3.cloudfront.net/${svgKey}`;
        console.log('\n3️⃣ Updating game with thumbnail URL...');
        
        const updateParams = {
            TableName: GAMES_TABLE,
            Key: {
                gameId: GAME_ID,
                version: '1.0.0'
            },
            UpdateExpression: 'SET thumbnailUrl = :url, imageUrl = :url, coverImageUrl = :url',
            ExpressionAttributeValues: {
                ':url': thumbnailUrl
            }
        };
        
        await dynamodb.update(updateParams).promise();
        console.log('✅ Database updated with thumbnail!');
        
        console.log('\n✅ THUMBNAIL UPLOAD COMPLETE!');
        console.log('========================');
        console.log(`SVG Thumbnail: ${thumbnailUrl}`);
        console.log(`HTML Preview: https://dgq2nqysbn2z3.cloudfront.net/${htmlKey}`);
        console.log('\nThe thumbnail should now appear in your games list!');
        
    } catch (error) {
        console.error('\n❌ Thumbnail upload failed:', error);
    }
}

// Run the upload
uploadThumbnail().then(() => {
    console.log('\n🏁 Script completed');
}).catch(error => {
    console.error('\n🚨 Script error:', error);
    process.exit(1);
});