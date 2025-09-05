// Backend script to test game upload directly
// This simulates what the portal does but runs from backend

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configuration
const DEVELOPER_ID = 'dev_c84a7e';
const DEVELOPER_NAME = 'FreddieTrioll';
const REGION = 'us-east-1';
const GAMES_BUCKET = 'trioll-prod-games-us-east-1';
const API_ENDPOINT = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';
const GAMES_TABLE = 'trioll-prod-games';

// Initialize AWS
AWS.config.update({ region: REGION });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Create a simple test game HTML
const testGameHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horror Pong</title>
    <style>
        body {
            margin: 0;
            background: #000;
            color: #0f0;
            font-family: monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
        }
        #game {
            border: 2px solid #0f0;
            position: relative;
        }
        .paddle {
            position: absolute;
            width: 10px;
            height: 80px;
            background: #0f0;
        }
        .ball {
            position: absolute;
            width: 10px;
            height: 10px;
            background: #f00;
            border-radius: 50%;
        }
        .score {
            position: absolute;
            top: 20px;
            font-size: 24px;
            color: #f00;
        }
        #title {
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 32px;
            color: #f00;
            text-shadow: 2px 2px 4px #000;
        }
    </style>
</head>
<body>
    <div id="game">
        <div id="title">HORROR PONG 👻</div>
        <canvas id="gameCanvas" width="800" height="400"></canvas>
    </div>
    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Game variables
        let ballX = canvas.width / 2;
        let ballY = canvas.height / 2;
        let ballSpeedX = 5;
        let ballSpeedY = 3;
        let leftPaddleY = canvas.height / 2 - 40;
        let rightPaddleY = canvas.height / 2 - 40;
        let leftScore = 0;
        let rightScore = 0;
        
        // Horror effects
        let screenShake = 0;
        let bloodDrops = [];
        
        function gameLoop() {
            // Clear canvas with slight transparency for trail effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Apply screen shake
            if (screenShake > 0) {
                ctx.save();
                ctx.translate(Math.random() * screenShake - screenShake/2, Math.random() * screenShake - screenShake/2);
                screenShake *= 0.9;
            }
            
            // Draw paddles
            ctx.fillStyle = '#0f0';
            ctx.fillRect(20, leftPaddleY, 10, 80);
            ctx.fillRect(canvas.width - 30, rightPaddleY, 10, 80);
            
            // Draw ball with glow effect
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f00';
            ctx.fillStyle = '#f00';
            ctx.beginPath();
            ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Update ball position
            ballX += ballSpeedX;
            ballY += ballSpeedY;
            
            // Ball collision with top/bottom
            if (ballY <= 5 || ballY >= canvas.height - 5) {
                ballSpeedY = -ballSpeedY;
                screenShake = 10;
            }
            
            // Ball collision with paddles
            if (ballX <= 35 && ballY >= leftPaddleY && ballY <= leftPaddleY + 80) {
                ballSpeedX = -ballSpeedX;
                screenShake = 15;
                createBloodSplatter(ballX, ballY);
            }
            
            if (ballX >= canvas.width - 35 && ballY >= rightPaddleY && ballY <= rightPaddleY + 80) {
                ballSpeedX = -ballSpeedX;
                screenShake = 15;
                createBloodSplatter(ballX, ballY);
            }
            
            // Score
            if (ballX < 0) {
                rightScore++;
                resetBall();
            }
            if (ballX > canvas.width) {
                leftScore++;
                resetBall();
            }
            
            // Draw scores
            ctx.fillStyle = '#f00';
            ctx.font = '30px monospace';
            ctx.fillText(leftScore, canvas.width/2 - 50, 40);
            ctx.fillText(rightScore, canvas.width/2 + 30, 40);
            
            // AI paddle movement
            if (rightPaddleY + 40 < ballY) rightPaddleY += 4;
            if (rightPaddleY + 40 > ballY) rightPaddleY -= 4;
            
            // Player paddle (follows mouse)
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                leftPaddleY = e.clientY - rect.top - 40;
            });
            
            // Draw blood drops
            bloodDrops.forEach((drop, index) => {
                ctx.fillStyle = 'rgba(255, 0, 0, ' + drop.alpha + ')';
                ctx.fillRect(drop.x, drop.y, 2, 5);
                drop.y += drop.speed;
                drop.alpha -= 0.01;
                if (drop.alpha <= 0) bloodDrops.splice(index, 1);
            });
            
            if (screenShake > 0) ctx.restore();
            
            requestAnimationFrame(gameLoop);
        }
        
        function resetBall() {
            ballX = canvas.width / 2;
            ballY = canvas.height / 2;
            ballSpeedX = -ballSpeedX;
            screenShake = 30;
        }
        
        function createBloodSplatter(x, y) {
            for (let i = 0; i < 10; i++) {
                bloodDrops.push({
                    x: x + Math.random() * 20 - 10,
                    y: y,
                    speed: Math.random() * 2 + 1,
                    alpha: 1
                });
            }
        }
        
        // Start game
        gameLoop();
        
        // Horror ambiance
        document.body.style.cursor = 'none';
        setInterval(() => {
            if (Math.random() > 0.8) {
                document.body.style.filter = 'brightness(' + (0.5 + Math.random() * 0.5) + ')';
                setTimeout(() => {
                    document.body.style.filter = 'brightness(1)';
                }, 100);
            }
        }, 3000);
    </script>
</body>
</html>`;

async function uploadGame() {
    console.log('🎮 Starting Horror Pong upload for FreddieTrioll (dev_c84a7e)');
    
    try {
        // Step 1: Generate unique game ID
        const gameId = `horror-pong-${Date.now()}`;
        const gameKey = `${gameId}/index.html`;
        
        console.log(`\n1️⃣ Generated game ID: ${gameId}`);
        
        // Step 2: Upload to S3
        console.log('\n2️⃣ Uploading to S3...');
        const s3Params = {
            Bucket: GAMES_BUCKET,
            Key: gameKey,
            Body: testGameHTML,
            ContentType: 'text/html'
            // ACL removed - bucket uses bucket policy for public access
        };
        
        const s3Result = await s3.upload(s3Params).promise();
        console.log('✅ S3 upload successful!');
        console.log(`   Location: ${s3Result.Location}`);
        console.log(`   CloudFront URL: https://dgq2nqysbn2z3.cloudfront.net/${gameKey}`);
        
        // Step 3: Create game metadata
        const gameData = {
            gameId: gameId,
            version: '1.0.0', // Required for composite key
            name: 'Horror Pong',
            title: 'Horror Pong', // Some code might use title instead of name
            description: 'A spooky version of the classic Pong game with horror effects',
            category: 'Arcade',
            genre: 'Arcade', // Some code might use genre
            developer: DEVELOPER_NAME,
            developerId: DEVELOPER_ID,
            deviceCompatibility: ['desktop', 'mobile', 'tablet'],
            deviceOrientation: 'landscape',
            controlStyle: 'mouse',
            gameStage: 'production',
            status: 'active',
            gameUrl: `https://dgq2nqysbn2z3.cloudfront.net/${gameKey}`,
            thumbnailUrl: '', // No thumbnail for now
            uploadedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            s3Folder: gameId,
            fileSize: '5KB',
            rating: 0,
            ratingCount: 0,
            playCount: 0,
            likeCount: 0,
            commentCount: 0,
            featured: false,
            trending: false
        };
        
        console.log('\n3️⃣ Saving to DynamoDB...');
        console.log('   Table:', GAMES_TABLE);
        console.log('   Game data:', JSON.stringify(gameData, null, 2));
        
        // Step 4: Save to DynamoDB
        const dynamoParams = {
            TableName: GAMES_TABLE,
            Item: gameData
        };
        
        await dynamodb.put(dynamoParams).promise();
        console.log('✅ Game saved to database!');
        
        // Step 5: Verify the game was saved
        console.log('\n4️⃣ Verifying game in database...');
        const getParams = {
            TableName: GAMES_TABLE,
            Key: {
                gameId: gameId,
                version: '1.0.0'
            }
        };
        
        const verification = await dynamodb.get(getParams).promise();
        if (verification.Item) {
            console.log('✅ Game verified in database!');
        } else {
            console.log('⚠️  Game not found in verification - might be eventual consistency');
        }
        
        // Success summary
        console.log('\n✅ UPLOAD COMPLETE!');
        console.log('========================');
        console.log(`Game Name: Horror Pong`);
        console.log(`Game ID: ${gameId}`);
        console.log(`Developer: ${DEVELOPER_NAME} (${DEVELOPER_ID})`);
        console.log(`Play URL: https://dgq2nqysbn2z3.cloudfront.net/${gameKey}`);
        console.log('\nThe game should now appear in your "My Games" tab!');
        
    } catch (error) {
        console.error('\n❌ Upload failed:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
        });
        
        if (error.code === 'CredentialsError') {
            console.log('\n💡 Fix: Configure AWS credentials with: aws configure');
        } else if (error.code === 'AccessDenied') {
            console.log('\n💡 Fix: Check IAM permissions for S3 and DynamoDB');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    uploadGame().then(() => {
        console.log('\n🏁 Script completed');
    }).catch(error => {
        console.error('\n🚨 Script error:', error);
        process.exit(1);
    });
}

module.exports = { uploadGame };