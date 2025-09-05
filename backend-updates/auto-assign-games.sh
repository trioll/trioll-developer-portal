#!/bin/bash

# Automated script to assign historical games to Freddie
# This creates and runs a Lambda function to update all orphan games

echo "🎮 Automated Game Assignment for FreddieTrioll"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
FUNCTION_NAME="trioll-assign-historical-games-auto"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::471112976510:role/trioll-lambda-role"

# Create Lambda function code
cat > /tmp/assign-games-lambda.js << 'EOF'
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

const GAMES_TABLE = 'trioll-prod-games';
const DEVELOPER_ID = 'dev_c84a7e';
const DEVELOPER_EMAIL = 'freddiecaplin@hotmail.com';
const DEVELOPER_NAME = 'FreddieTrioll';

exports.handler = async (event) => {
    console.log(`Assigning historical games to ${DEVELOPER_NAME} (${DEVELOPER_ID})`);
    
    try {
        // Step 1: Scan for all games without developerId
        console.log('Scanning for games without developerId...');
        const scanParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'attribute_not_exists(developerId) OR developerId = :empty',
            ExpressionAttributeValues: {
                ':empty': ''
            }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        const orphanGames = scanResult.Items || [];
        
        console.log(`Found ${orphanGames.length} games without developerId`);
        
        if (orphanGames.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No orphan games found. All games already have developer IDs.',
                    gamesUpdated: 0
                })
            };
        }
        
        // Step 2: Update each game
        console.log('Updating games...');
        const updateResults = {
            total: orphanGames.length,
            updated: [],
            failed: []
        };
        
        for (const game of orphanGames) {
            try {
                const gameId = game.id || game.gameId;
                const gameName = game.name || game.title || 'Untitled';
                
                const updateParams = {
                    TableName: GAMES_TABLE,
                    Key: { id: gameId },
                    UpdateExpression: 'SET developerId = :devId, developer = :devName, updatedAt = :timestamp',
                    ExpressionAttributeValues: {
                        ':devId': DEVELOPER_ID,
                        ':devName': DEVELOPER_NAME,
                        ':timestamp': new Date().toISOString()
                    },
                    ReturnValues: 'UPDATED_NEW'
                };
                
                await dynamodb.update(updateParams).promise();
                updateResults.updated.push(`${gameName} (${gameId})`);
                console.log(`✓ Updated: ${gameName}`);
                
            } catch (error) {
                const gameId = game.id || game.gameId;
                updateResults.failed.push(`${gameId}: ${error.message}`);
                console.error(`✗ Failed to update ${gameId}: ${error.message}`);
            }
        }
        
        // Step 3: Verify total games assigned to Freddie
        const verifyParams = {
            TableName: GAMES_TABLE,
            FilterExpression: 'developerId = :devId',
            ExpressionAttributeValues: {
                ':devId': DEVELOPER_ID
            }
        };
        
        const verifyResult = await dynamodb.scan(verifyParams).promise();
        const totalGamesForFreddie = verifyResult.Items.length;
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Historical games assignment complete!',
                results: {
                    gamesProcessed: updateResults.total,
                    successfullyUpdated: updateResults.updated.length,
                    failed: updateResults.failed.length,
                    updatedGames: updateResults.updated,
                    failedGames: updateResults.failed,
                    totalGamesNowOwnedByFreddie: totalGamesForFreddie
                }
            })
        };
        
    } catch (error) {
        console.error('Error during assignment:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};
EOF

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
cd /tmp
zip -q assign-games-lambda.zip assign-games-lambda.js

# Check if Lambda function exists
echo -e "${YELLOW}Checking if Lambda function exists...${NC}"
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
    echo -e "${GREEN}Function exists, updating code...${NC}"
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://assign-games-lambda.zip \
        --region $REGION > /dev/null
else
    echo -e "${YELLOW}Creating new Lambda function...${NC}"
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler assign-games-lambda.handler \
        --timeout 300 \
        --memory-size 512 \
        --zip-file fileb://assign-games-lambda.zip \
        --region $REGION > /dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create Lambda function. Please check IAM role ARN.${NC}"
        exit 1
    fi
fi

# Wait a moment for the function to be ready
sleep 2

# Invoke the function
echo -e "\n${GREEN}Running the game assignment...${NC}"
aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    /tmp/assignment-result.json > /dev/null

# Display results
echo -e "\n${GREEN}=== RESULTS ===${NC}"
cat /tmp/assignment-result.json | jq '.' 2>/dev/null || cat /tmp/assignment-result.json

# Parse and display summary
if command -v jq &> /dev/null; then
    echo -e "\n${GREEN}=== SUMMARY ===${NC}"
    UPDATED=$(cat /tmp/assignment-result.json | jq -r '.results.successfullyUpdated // 0' 2>/dev/null)
    TOTAL_GAMES=$(cat /tmp/assignment-result.json | jq -r '.results.totalGamesNowOwnedByFreddie // 0' 2>/dev/null)
    
    echo -e "Games updated: ${GREEN}$UPDATED${NC}"
    echo -e "Total games owned by FreddieTrioll: ${GREEN}$TOTAL_GAMES${NC}"
fi

# Cleanup
rm -f /tmp/assign-games-lambda.js /tmp/assign-games-lambda.zip /tmp/assignment-result.json

echo -e "\n${GREEN}✅ Process complete!${NC}"
echo -e "${YELLOW}Note: The My Games tab should now show all your historical games.${NC}"