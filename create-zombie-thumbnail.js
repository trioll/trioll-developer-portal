// Script to create and upload thumbnail for Zombie Survival

const AWS = require('aws-sdk');

// Configuration
const REGION = 'us-east-1';
const GAMES_BUCKET = 'trioll-prod-games-us-east-1';
const GAMES_TABLE = 'trioll-prod-games';
const GAME_ID = 'zombie-survival-1751897800105';

// Initialize AWS
AWS.config.update({ region: REGION });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Create a zombie-themed SVG thumbnail
const zombieThumbnailSVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark background -->
  <rect width="400" height="300" fill="#1a0f0a"/>
  
  <!-- Blood splatter background effect -->
  <ellipse cx="350" cy="50" rx="60" ry="40" fill="#8b0000" opacity="0.3"/>
  <ellipse cx="50" cy="250" rx="80" ry="50" fill="#8b0000" opacity="0.2"/>
  
  <!-- Title with dripping blood effect -->
  <text x="200" y="50" font-family="Impact, sans-serif" font-size="42" fill="#8b0000" text-anchor="middle" font-weight="bold">ZOMBIE</text>
  <text x="200" y="90" font-family="Impact, sans-serif" font-size="42" fill="#8b0000" text-anchor="middle" font-weight="bold">SURVIVAL</text>
  
  <!-- Blood drips from title -->
  <rect x="195" y="90" width="3" height="15" fill="#8b0000" opacity="0.7"/>
  <rect x="250" y="90" width="2" height="20" fill="#8b0000" opacity="0.6"/>
  <rect x="150" y="50" width="2" height="12" fill="#8b0000" opacity="0.5"/>
  
  <!-- Zombie silhouette -->
  <g transform="translate(200, 180)">
    <!-- Body -->
    <ellipse cx="0" cy="0" rx="40" ry="60" fill="#2d4a2b"/>
    <!-- Head -->
    <circle cx="0" cy="-50" r="30" fill="#2d4a2b"/>
    <!-- Arms -->
    <rect x="-60" y="-20" width="20" height="50" fill="#2d4a2b" transform="rotate(-30 -50 -20)"/>
    <rect x="40" y="-20" width="20" height="50" fill="#2d4a2b" transform="rotate(30 50 -20)"/>
    
    <!-- Zombie eyes (glowing) -->
    <circle cx="-10" cy="-55" r="5" fill="#ff0000"/>
    <circle cx="10" cy="-55" r="5" fill="#ff0000"/>
    <circle cx="-10" cy="-55" r="7" fill="#ff0000" opacity="0.3"/>
    <circle cx="10" cy="-55" r="7" fill="#ff0000" opacity="0.3"/>
  </g>
  
  <!-- Zombie hands reaching from bottom -->
  <g transform="translate(80, 280)">
    <path d="M0,0 L-10,-30 L-5,-35 L0,-32 L5,-36 L10,-33 L15,-37 L20,-34 L15,-30 L10,-25 Z" fill="#2d4a2b"/>
  </g>
  <g transform="translate(320, 280)">
    <path d="M0,0 L-10,-30 L-5,-35 L0,-32 L5,-36 L10,-33 L15,-37 L20,-34 L15,-30 L10,-25 Z" fill="#2d4a2b"/>
  </g>
  
  <!-- Crosshair -->
  <g transform="translate(200, 180)" opacity="0.7">
    <circle cx="0" cy="0" r="40" fill="none" stroke="#00ff00" stroke-width="2"/>
    <line x1="-50" y1="0" x2="-30" y2="0" stroke="#00ff00" stroke-width="2"/>
    <line x1="30" y1="0" x2="50" y2="0" stroke="#00ff00" stroke-width="2"/>
    <line x1="0" y1="-50" x2="0" y2="-30" stroke="#00ff00" stroke-width="2"/>
    <line x1="0" y1="30" x2="0" y2="50" stroke="#00ff00" stroke-width="2"/>
  </g>
  
  <!-- Warning text -->
  <text x="200" y="270" font-family="monospace" font-size="14" fill="#00ff00" text-anchor="middle">STAY ALIVE</text>
  
  <!-- Border with scratches effect -->
  <rect x="2" y="2" width="396" height="296" fill="none" stroke="#8b0000" stroke-width="2" opacity="0.5"/>
  <path d="M50,2 L55,10 M100,2 L97,8 M300,298 L305,290" stroke="#8b0000" stroke-width="1" opacity="0.7"/>
</svg>`;

// Create HTML version with animations
const zombieThumbnailHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            background: #1a0f0a;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: Impact, sans-serif;
            overflow: hidden;
        }
        .thumbnail {
            text-align: center;
            position: relative;
            width: 400px;
            height: 300px;
        }
        .title {
            color: #8b0000;
            font-size: 48px;
            text-shadow: 2px 2px 4px #000;
            margin: 0;
            position: relative;
        }
        .blood-drip {
            position: absolute;
            width: 3px;
            background: #8b0000;
            animation: drip 3s infinite;
        }
        .zombie {
            width: 100px;
            height: 100px;
            background: #2d4a2b;
            border-radius: 50%;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 50px rgba(0,0,0,0.8);
        }
        .zombie::before, .zombie::after {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            background: #ff0000;
            border-radius: 50%;
            top: 20px;
            box-shadow: 0 0 10px #ff0000;
            animation: glow 2s infinite;
        }
        .zombie::before { left: 25px; }
        .zombie::after { right: 25px; }
        
        .crosshair {
            position: absolute;
            width: 100px;
            height: 100px;
            border: 2px solid #00ff00;
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.7;
        }
        .crosshair::before,
        .crosshair::after {
            content: '';
            position: absolute;
            background: #00ff00;
        }
        .crosshair::before {
            width: 100%;
            height: 2px;
            top: 50%;
            transform: translateY(-50%);
        }
        .crosshair::after {
            width: 2px;
            height: 100%;
            left: 50%;
            transform: translateX(-50%);
        }
        
        @keyframes drip {
            0% { height: 0; }
            50% { height: 20px; }
            100% { height: 0; }
        }
        
        @keyframes glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .warning {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: #00ff00;
            font-family: monospace;
            font-size: 16px;
            animation: flicker 3s infinite;
        }
        
        @keyframes flicker {
            0%, 100% { opacity: 1; }
            80% { opacity: 1; }
            85% { opacity: 0; }
            90% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="thumbnail">
        <h1 class="title">ZOMBIE</h1>
        <h1 class="title" style="margin-top: -20px;">SURVIVAL</h1>
        <div class="blood-drip" style="left: 45%; top: 80px;"></div>
        <div class="blood-drip" style="left: 60%; top: 80px; animation-delay: 1s;"></div>
        <div class="zombie"></div>
        <div class="crosshair"></div>
        <div class="warning">STAY ALIVE</div>
    </div>
</body>
</html>`;

async function createZombieThumbnail() {
    console.log('🧟 Creating thumbnail for Zombie Survival...');
    
    try {
        // Upload SVG thumbnail
        const svgKey = `${GAME_ID}/zombie-thumbnail.svg`;
        console.log('\n1️⃣ Uploading SVG thumbnail...');
        
        const svgParams = {
            Bucket: GAMES_BUCKET,
            Key: svgKey,
            Body: zombieThumbnailSVG,
            ContentType: 'image/svg+xml'
        };
        
        const svgResult = await s3.upload(svgParams).promise();
        console.log('✅ SVG thumbnail uploaded!');
        console.log(`   Location: ${svgResult.Location}`);
        
        // Upload HTML thumbnail
        const htmlKey = `${GAME_ID}/zombie-thumbnail.html`;
        console.log('\n2️⃣ Uploading HTML thumbnail...');
        
        const htmlParams = {
            Bucket: GAMES_BUCKET,
            Key: htmlKey,
            Body: zombieThumbnailHTML,
            ContentType: 'text/html'
        };
        
        const htmlResult = await s3.upload(htmlParams).promise();
        console.log('✅ HTML thumbnail uploaded!');
        
        // Update DynamoDB with correct thumbnail URL
        const thumbnailUrl = `https://dgq2nqysbn2z3.cloudfront.net/${svgKey}`;
        console.log('\n3️⃣ Updating database with thumbnail URL...');
        
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
        console.log('✅ Database updated with thumbnail URL!');
        
        console.log('\n🧟 ZOMBIE THUMBNAIL COMPLETE!');
        console.log('================================');
        console.log(`SVG Thumbnail: ${thumbnailUrl}`);
        console.log(`HTML Preview: https://dgq2nqysbn2z3.cloudfront.net/${htmlKey}`);
        console.log('\nZombie Survival now has a proper thumbnail!');
        
    } catch (error) {
        console.error('\n❌ Error creating thumbnail:', error);
    }
}

// Run the script
createZombieThumbnail().then(() => {
    console.log('\n🏁 Script completed');
}).catch(error => {
    console.error('\n🚨 Script error:', error);
    process.exit(1);
});