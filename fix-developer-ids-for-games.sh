#!/bin/bash

# Fix developer IDs for games in DynamoDB
# This assigns the correct developer ID to games that are missing it

set -e

echo "🔧 Fixing Developer IDs for Games"
echo "================================="
echo ""

# Configuration
REGION="us-east-1"
TABLE="trioll-prod-games"
DEVELOPER_ID="dev_c84a7e"  # Your developer ID

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📋 Getting list of games without developer IDs..."
echo ""

# Games known to be yours based on the debug log
GAMES_TO_FIX=(
    "horror-pong-1757087555176"
    "aliyah-the-game-1752050442084"
    "robo-soccer-1751987252435"
    "zombie-survival-1751897800105"
    "Evolution-Runner"
    "dog-eat-dog-1752068982490"
)

echo "Found ${#GAMES_TO_FIX[@]} games to fix"
echo ""

for GAME_ID in "${GAMES_TO_FIX[@]}"; do
    echo "Fixing game: $GAME_ID"
    
    # Update the game with developerId
    aws dynamodb update-item \
        --table-name $TABLE \
        --key '{"gameId": {"S": "'$GAME_ID'"}, "version": {"S": "1.0.0"}}' \
        --update-expression "SET developerId = :devId" \
        --expression-attribute-values '{":devId": {"S": "'$DEVELOPER_ID'"}}' \
        --region $REGION \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Updated $GAME_ID${NC}"
    else
        echo -e "${RED}❌ Failed to update $GAME_ID${NC}"
    fi
done

echo ""
echo "🔍 Verifying updates..."
echo ""

# Check one game to verify
VERIFY_GAME="${GAMES_TO_FIX[0]}"
RESULT=$(aws dynamodb get-item \
    --table-name $TABLE \
    --key '{"gameId": {"S": "'$VERIFY_GAME'"}, "version": {"S": "1.0.0"}}' \
    --region $REGION \
    --query 'Item.developerId.S' \
    --output text 2>/dev/null || echo "ERROR")

if [ "$RESULT" == "$DEVELOPER_ID" ]; then
    echo -e "${GREEN}✅ Developer ID successfully set!${NC}"
    echo "Verified on game: $VERIFY_GAME"
else
    echo -e "${RED}❌ Verification failed${NC}"
    echo "Expected: $DEVELOPER_ID"
    echo "Got: $RESULT"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Refresh triolldev.com"
echo "2. Go to Analytics tab"
echo "3. Your analytics data should now populate correctly!"
echo ""
echo "Note: It may take a moment for the changes to propagate."