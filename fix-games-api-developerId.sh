#!/bin/bash

# Fix games-api.js to include developerId in API responses
# This script updates the Lambda function to return the developerId field

set -e

echo "🔧 Fixing games-api.js to include developerId field"
echo "================================================"
echo ""

# Configuration
BACKEND_DIR="/Users/frederickcaplin/Trioll-Mobile-App-Final-Version/backend-api-deployment"
LAMBDA_FILE="$BACKEND_DIR/lambda-functions/games-api.js"
REGION="us-east-1"
FUNCTION_NAME="trioll-prod-games-api"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📍 Checking if games-api.js exists..."
if [ ! -f "$LAMBDA_FILE" ]; then
    echo -e "${RED}❌ Error: games-api.js not found at $LAMBDA_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found games-api.js${NC}"
echo ""

echo "📝 Creating backup..."
cp "$LAMBDA_FILE" "$LAMBDA_FILE.backup-$(date +%Y%m%d-%H%M%S)"

echo "🔄 Updating transformGame() function to include developerId..."

# Use sed to add developerId after developerName line
# This adds the developerId field to the API response
sed -i '' '/developerName: item.developerName/a\
    developerId: item.developerId || null,
' "$LAMBDA_FILE"

echo -e "${GREEN}✅ Updated transformGame() function${NC}"
echo ""

echo "📋 Showing the change:"
echo "------------------------"
grep -A 1 -B 1 "developerId: item.developerId" "$LAMBDA_FILE" || echo "Line added after developerName"
echo "------------------------"
echo ""

echo "🚀 Deploying to AWS Lambda..."
cd "$BACKEND_DIR"

# Create deployment package
echo "Creating deployment package..."
cd lambda-functions
zip -q games-api-updated.zip games-api.js

# Update Lambda function
echo "Uploading to Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://games-api-updated.zip \
    --region $REGION \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda function updated successfully!${NC}"
    
    # Clean up
    rm games-api-updated.zip
    
    echo ""
    echo "✨ Success! The developerId field will now be included in all game API responses."
    echo ""
    echo "🔍 To verify:"
    echo "1. Go to triolldev.com"
    echo "2. Open Debug tab"
    echo "3. Run 'Check Standardization' test"
    echo "4. Games should now show their developerId values"
else
    echo -e "${RED}❌ Failed to update Lambda function${NC}"
    echo "Please check AWS credentials and permissions"
    exit 1
fi

echo ""
echo "📝 Note: If games still show 'developerId: none', they may need to be updated in DynamoDB"
echo "to add the developerId field. The backend-api-deployment directory should have scripts for this."