#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fixing CORS configuration for games API...${NC}"

# Update environment variables to allow all origins
echo "Updating CORS configuration..."
aws lambda update-function-configuration \
    --function-name trioll-prod-games-api \
    --environment Variables="{
        GAMES_TABLE=trioll-prod-games,
        USERS_TABLE=trioll-prod-users,
        ALLOWED_ORIGINS=*
    }" \
    --timeout 30

echo -e "${GREEN}CORS configuration updated!${NC}"

# Also update the API Gateway CORS configuration
echo -e "${YELLOW}Updating API Gateway CORS settings...${NC}"

# Get games resource ID
GAMES_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id 4ib0hvu1xj --query "items[?path=='/games'].id" --output text)

# Update OPTIONS method response headers for /games
echo "Updating OPTIONS response for /games..."
aws apigateway update-method-response \
    --rest-api-id 4ib0hvu1xj \
    --resource-id $GAMES_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --patch-operations \
    op=replace,path=/responseParameters/method.response.header.Access-Control-Allow-Headers,value="'Content-Type,Authorization,X-Guest-Mode,X-Identity-Id,X-App-Client,X-App-Source,X-Platform'" \
    2>/dev/null || echo "OPTIONS method response update skipped"

# Deploy API changes
echo "Deploying API Gateway changes..."
aws apigateway create-deployment \
    --rest-api-id 4ib0hvu1xj \
    --stage-name prod \
    --description "Fixed CORS headers for games API"

echo -e "${GREEN}CORS fix complete!${NC}"