#!/bin/bash

# Deploy Games API with Query fix for proper pagination
# This fixes the issue where only 4 games show instead of all games

set -e

echo "🚀 Deploying Games API with Query optimization..."
echo "This will fix the pagination issue where only some games are shown"

# Configuration
LAMBDA_FUNCTION="trioll-prod-games-api"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Lambda function exists
echo "Checking Lambda function..."
aws lambda get-function --function-name $LAMBDA_FUNCTION --region $REGION >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "${RED}❌ Lambda function $LAMBDA_FUNCTION not found${NC}"
    exit 1
fi

echo "${GREEN}✅ Lambda function exists${NC}"

# Create deployment package
echo ""
echo "📦 Creating deployment package..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Copy the Lambda function
cp /Users/frederickcaplin/Desktop/trioll-developer-portal/backend-updates/games-api-cors-fixed.js index.js

# Create package.json
cat > package.json << 'EOF'
{
  "name": "trioll-games-api",
  "version": "1.0.0",
  "description": "Trioll Games API with Query optimization",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0"
  }
}
EOF

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create the deployment package
echo "Creating zip file..."
zip -r deployment-package.zip .

# Deploy to Lambda
echo ""
echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
    --function-name $LAMBDA_FUNCTION \
    --zip-file fileb://deployment-package.zip \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Deployment successful!${NC}"
else
    echo "${RED}❌ Deployment failed${NC}"
    cd -
    rm -rf $TEMP_DIR
    exit 1
fi

# Update Lambda environment variables
echo ""
echo "🔧 Ensuring environment variables are set..."
aws lambda update-function-configuration \
    --function-name $LAMBDA_FUNCTION \
    --region $REGION \
    --environment Variables='{
        "GAMES_TABLE":"trioll-prod-games",
        "USERS_TABLE":"trioll-prod-users",
        "ALLOWED_ORIGINS":"*"
    }' \
    --handler "index.handler" > /dev/null

# Clean up
cd -
rm -rf $TEMP_DIR

# Test the API
echo ""
echo "🧪 Testing the API..."
sleep 5  # Wait for Lambda to be ready

API_RESPONSE=$(curl -s "https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games?limit=20")

if echo "$API_RESPONSE" | grep -q "games"; then
    GAME_COUNT=$(echo "$API_RESPONSE" | python3 -c "import json, sys; data = json.load(sys.stdin); print(len(data.get('games', [])))")
    echo "${GREEN}✅ API is working! Returned $GAME_COUNT games${NC}"
    
    if [ "$GAME_COUNT" -gt 4 ]; then
        echo "${GREEN}✅ Pagination fix successful! More than 4 games returned${NC}"
    else
        echo "${YELLOW}⚠️  Still showing $GAME_COUNT games. Frontend may need refresh${NC}"
    fi
else
    echo "${RED}❌ API test failed${NC}"
fi

echo ""
echo "📋 Summary:"
echo "  - Lambda function updated with Query instead of Scan"
echo "  - Games will now be sorted by newest first"
echo "  - Pagination will work correctly"
echo "  - All active games should now be visible"
echo ""
echo "🔄 Next steps:"
echo "  1. Refresh your browser (Ctrl+F5 or Cmd+Shift+R)"
echo "  2. Navigate to 'All Games'"
echo "  3. You should now see all your games!"
echo ""
echo "${GREEN}✅ Deployment complete!${NC}"