#!/bin/bash

# Deploy Lambda Functions with Developer Authentication Updates

set -e

echo "🚀 Deploying Lambda Functions with Developer Authentication..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
REGION="us-east-1"

# Check if client ID file exists
if [ ! -f "developer-portal-client-id.txt" ]; then
    echo -e "${RED}❌ Error: developer-portal-client-id.txt not found!${NC}"
    echo "Please run setup-developer-infrastructure.sh first."
    exit 1
fi

DEVELOPER_CLIENT_ID=$(cat developer-portal-client-id.txt)
echo -e "${GREEN}Using Developer Client ID: $DEVELOPER_CLIENT_ID${NC}"

# Step 1: Deploy users-api with developer endpoints
echo -e "\n${YELLOW}Step 1: Deploying users-api with developer endpoints...${NC}"

cd backend-updates

# Create deployment package for users-api
echo "Creating deployment package for users-api..."
cp users-api-with-developers.js index.js
zip -r users-api-deployment.zip index.js

# Deploy users-api
echo "Deploying users-api..."
aws lambda update-function-code \
    --function-name trioll-prod-users-api \
    --zip-file fileb://users-api-deployment.zip \
    --region $REGION || {
    echo -e "${RED}Note: Lambda function 'trioll-prod-users-api' might not exist.${NC}"
    echo "Creating it or using the existing function name..."
}

# Update environment variables
echo "Updating users-api environment variables..."
aws lambda update-function-configuration \
    --function-name trioll-prod-users-api \
    --environment Variables="{
        \"DEVELOPER_APP_CLIENT_ID\":\"$DEVELOPER_CLIENT_ID\",
        \"ALLOWED_ORIGINS\":\"https://triolldev.com,https://www.triolldev.com,http://localhost:5500,http://127.0.0.1:5500\"
    }" \
    --timeout 30 \
    --region $REGION || echo "Could not update users-api config"

# Clean up
rm index.js users-api-deployment.zip

echo -e "${GREEN}✓ users-api deployed!${NC}"

# Step 2: Deploy games-api with developer authentication
echo -e "\n${YELLOW}Step 2: Deploying games-api with developer authentication...${NC}"

# Create deployment package for games-api
echo "Creating deployment package for games-api..."
cp games-api-with-developers.js index.js
zip -r games-api-deployment.zip index.js

# Deploy games-api (using the correct Lambda name)
echo "Deploying games-api..."
aws lambda update-function-code \
    --function-name trioll-prod-get-games \
    --zip-file fileb://games-api-deployment.zip \
    --region $REGION

# Update environment variables
echo "Updating games-api environment variables..."
aws lambda update-function-configuration \
    --function-name trioll-prod-get-games \
    --environment Variables="{
        \"DEVELOPER_APP_CLIENT_ID\":\"$DEVELOPER_CLIENT_ID\",
        \"ALLOWED_ORIGINS\":\"https://triolldev.com,https://www.triolldev.com,http://localhost:5500,http://127.0.0.1:5500\"
    }" \
    --timeout 30 \
    --region $REGION

# Clean up
rm index.js games-api-deployment.zip

echo -e "${GREEN}✓ games-api deployed!${NC}"

# Step 3: Test the endpoints
echo -e "\n${YELLOW}Step 3: Testing developer endpoints...${NC}"

API_URL="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod"

# Test CORS
echo "Testing CORS for triolldev.com..."
curl -s -X OPTIONS "$API_URL/developers/register" \
    -H "Origin: https://triolldev.com" \
    -H "Access-Control-Request-Method: POST" \
    -I | grep -i "access-control-allow-origin" || echo "CORS test failed"

cd ..

# Summary
echo -e "\n${GREEN}=================================================="
echo "✅ Lambda Deployment Complete!"
echo "=================================================="
echo -e "${NC}"
echo "Deployed Functions:"
echo "- users-api: Added /developers/* endpoints"
echo "- games-api: Added developer authentication for POST /games"
echo ""
echo "New Endpoints Available:"
echo "- POST $API_URL/developers/register"
echo "- POST $API_URL/developers/login"
echo "- GET  $API_URL/developers/profile"
echo "- PUT  $API_URL/developers/profile"
echo "- GET  $API_URL/developers/games"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update the Cognito Identity Pool mapping (if not done)"
echo "2. Test developer registration with:"
echo "   curl -X POST $API_URL/developers/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'X-App-Client: developer-portal' \\"
echo "     -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"companyName\":\"Test Studio\"}'"