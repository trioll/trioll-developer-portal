#!/bin/bash

# Deploy Script for Fixed Games API
# This script deploys the fixed games-api Lambda with corrected route handling

set -e  # Exit on error

echo "🚀 Starting deployment of Fixed Games API..."

# Configuration
FUNCTION_NAME="trioll-prod-games-api"
REGION="us-east-1"
RUNTIME="nodejs20.x"
HANDLER="games-api-fixed.handler"
TIMEOUT=30
MEMORY=256

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create temporary directory for deployment package
echo "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
cp games-api-fixed.js $TEMP_DIR/

# Create package.json for Lambda dependencies
cat > $TEMP_DIR/package.json << 'EOF'
{
  "name": "games-api-fixed",
  "version": "1.0.0",
  "description": "Fixed Lambda function for games API with developer routes",
  "main": "games-api-fixed.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.614.0",
    "@aws-sdk/lib-dynamodb": "^3.614.0"
  }
}
EOF

# Install dependencies
echo "📥 Installing dependencies..."
cd $TEMP_DIR
npm install --production

# Create ZIP file
echo "🗜️  Creating deployment ZIP..."
zip -r deployment.zip .

# Update Lambda function
echo "🔄 Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION

echo "${GREEN}✅ Lambda function code updated${NC}"

# Update handler to use new file
echo "📝 Updating Lambda handler..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --handler $HANDLER \
    --runtime $RUNTIME \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION

# Update environment variables
echo "🔧 Updating environment variables..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment '{"Variables":{"GAMES_TABLE":"trioll-prod-games","USERS_TABLE":"trioll-prod-users","ALLOWED_ORIGINS":"https://triolldev.com","REGION":"us-east-1"}}' \
    --region $REGION

# Wait for function to be updated
echo "⏳ Waiting for function to be ready..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

# Clean up
echo "🧹 Cleaning up..."
cd - > /dev/null
rm -rf $TEMP_DIR

echo ""
echo "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - Lambda Function: $FUNCTION_NAME"
echo "  - Handler: $HANDLER"
echo "  - Region: $REGION"
echo "  - Fixed Issues:"
echo "    ✓ Route matching for /developers/games"
echo "    ✓ Developer authentication check"
echo "    ✓ Enhanced error logging"
echo ""
echo "🧪 Test the fixed endpoints:"
echo "1. Developer's games:"
echo "   curl -X GET https://4ib0hvu1xj.execute-api.$REGION.amazonaws.com/prod/developers/games \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -H 'X-App-Client: developer-portal'"
echo ""
echo "2. All games:"
echo "   curl -X GET https://4ib0hvu1xj.execute-api.$REGION.amazonaws.com/prod/games"
echo ""