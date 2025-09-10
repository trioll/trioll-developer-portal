#!/bin/bash

# Fix all Lambda handler configurations
# This script checks what files are actually deployed and fixes handlers

set -e

echo "🔧 Fixing All Lambda Handler Configurations"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REGION="us-east-1"

# Function to check and fix handler
fix_lambda_handler() {
    local function_name=$1
    local expected_handler=$2
    
    echo ""
    echo "📋 Checking $function_name..."
    echo "================================"
    
    # Get current handler
    CURRENT_HANDLER=$(aws lambda get-function-configuration \
        --function-name $function_name \
        --region $REGION \
        --query Handler \
        --output text 2>/dev/null || echo "ERROR")
    
    if [ "$CURRENT_HANDLER" == "ERROR" ]; then
        echo -e "${RED}❌ Function not found or error${NC}"
        return
    fi
    
    echo "Current handler: $CURRENT_HANDLER"
    echo "Expected handler: $expected_handler"
    
    if [ "$CURRENT_HANDLER" != "$expected_handler" ]; then
        echo -e "${YELLOW}⚠️ Handler mismatch - updating...${NC}"
        
        aws lambda update-function-configuration \
            --function-name $function_name \
            --handler "$expected_handler" \
            --region $REGION >/dev/null
        
        # Wait for update
        aws lambda wait function-updated \
            --function-name $function_name \
            --region $REGION
        
        echo -e "${GREEN}✅ Handler updated to: $expected_handler${NC}"
    else
        echo -e "${GREEN}✅ Handler already correct${NC}"
    fi
}

# Check what the actual handler should be for interactions API
echo "🔍 Checking deployed code for interactions API..."
echo "================================================"

# Download the function code to inspect
aws lambda get-function --function-name trioll-prod-interactions-api --region $REGION --query 'Code.Location' --output text > /tmp/lambda-url.txt 2>/dev/null

if [ -s /tmp/lambda-url.txt ]; then
    echo "Downloading Lambda package..."
    curl -s $(cat /tmp/lambda-url.txt) -o /tmp/interactions-lambda.zip
    
    echo "Inspecting package contents..."
    unzip -l /tmp/interactions-lambda.zip | grep -E '\.js$' | head -10
    
    # Check if it's interactions-api.js or interactions-dynamodb-final.js
    if unzip -l /tmp/interactions-lambda.zip | grep -q "interactions-api.js"; then
        INTERACTIONS_HANDLER="interactions-api.handler"
    elif unzip -l /tmp/interactions-lambda.zip | grep -q "interactions.js"; then
        INTERACTIONS_HANDLER="interactions.handler"
    else
        # Assume index.js exists
        INTERACTIONS_HANDLER="index.handler"
    fi
    
    echo -e "${YELLOW}Detected handler should be: $INTERACTIONS_HANDLER${NC}"
    
    # Update the handler
    fix_lambda_handler "trioll-prod-interactions-api" "$INTERACTIONS_HANDLER"
    
    rm -f /tmp/interactions-lambda.zip /tmp/lambda-url.txt
fi

# Fix games API (we already know this one)
fix_lambda_handler "trioll-prod-games-api" "games-api.handler"

# Test the endpoints
echo ""
echo "📋 Testing endpoints..."
echo "====================="

echo ""
echo "Testing GET /games..."
GAMES_RESPONSE=$(curl -s -w "STATUS:%{http_code}" "https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games")
STATUS=$(echo "$GAMES_RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)

if [ "$STATUS" == "200" ]; then
    echo -e "${GREEN}✅ /games endpoint working (Status: $STATUS)${NC}"
else
    echo -e "${RED}❌ /games endpoint failed (Status: $STATUS)${NC}"
fi

echo ""
echo "Testing GET /games/{id}/likes..."
LIKES_RESPONSE=$(curl -s -w "STATUS:%{http_code}" "https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/Evolution-Runner/likes")
STATUS=$(echo "$LIKES_RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)

if [ "$STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Interactions endpoint working (Status: $STATUS)${NC}"
else
    echo -e "${RED}❌ Interactions endpoint failed (Status: $STATUS)${NC}"
fi

echo ""
echo "🎯 Summary:"
echo "=========="
echo "1. Lambda handlers have been checked and updated"
echo "2. Test triolldev.com now - your games should appear"
echo "3. Analytics data should populate correctly"