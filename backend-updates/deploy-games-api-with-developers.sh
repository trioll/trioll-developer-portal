#!/bin/bash

# Deploy Script for Games API with Developer Routes
# This script updates the existing games-api Lambda to include developer routes

set -e  # Exit on error

echo "🚀 Starting deployment of Games API with Developer Routes..."

# Configuration
FUNCTION_NAME="trioll-prod-games-api"
REGION="us-east-1"
RUNTIME="nodejs20.x"
HANDLER="games-api-with-developers.handler"
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
cp games-api-with-developers.js $TEMP_DIR/

# Create package.json for Lambda dependencies
cat > $TEMP_DIR/package.json << 'EOF'
{
  "name": "games-api-with-developers",
  "version": "1.0.0",
  "description": "Lambda function for games API with developer routes",
  "main": "games-api-with-developers.js",
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
echo "🔄 Updating Lambda function..."
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
    --region $REGION

# Configure API Gateway for new route
echo "🔧 Configuring API Gateway for /developers/games..."

# Get API Gateway ID
API_ID="4ib0hvu1xj"
API_NAME="trioll-prod-api"

# Check if /developers resource exists
DEVELOPERS_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
    --query "items[?path=='/developers'].id" --output text)

if [ -z "$DEVELOPERS_RESOURCE" ]; then
    echo "Creating /developers resource..."
    ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
        --query "items[?path=='/'].id" --output text)
    
    DEVELOPERS_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_ID \
        --path-part "developers" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

# Check if /developers/games resource exists
GAMES_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
    --query "items[?path=='/developers/games'].id" --output text)

if [ -z "$GAMES_RESOURCE" ]; then
    echo "Creating /developers/games resource..."
    GAMES_RESOURCE=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $DEVELOPERS_RESOURCE \
        --path-part "games" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

# Configure GET method for /developers/games
if ! aws apigateway get-method --rest-api-id $API_ID --resource-id $GAMES_RESOURCE \
    --http-method GET --region $REGION 2>/dev/null; then
    
    echo "Creating GET method for /developers/games..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method GET \
        --authorization-type NONE \
        --region $REGION
    
    # Configure Lambda integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method GET \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME/invocations" \
        --region $REGION
fi

# Configure OPTIONS method for CORS on /developers/games
if ! aws apigateway get-method --rest-api-id $API_ID --resource-id $GAMES_RESOURCE \
    --http-method OPTIONS --region $REGION 2>/dev/null; then
    
    echo "Creating OPTIONS method for CORS on /developers/games..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
    
    # Configure mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # Configure method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --region $REGION
    
    # Configure integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $GAMES_RESOURCE \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-App-Client'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
fi

# Update Lambda permissions
echo "🔐 Updating Lambda permissions..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-developers-games \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
    --region $REGION 2>/dev/null || true

# Deploy API Gateway
echo "🚀 Deploying API Gateway..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION

# Clean up
echo "🧹 Cleaning up..."
rm -rf $TEMP_DIR

echo ""
echo "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - Lambda Function: $FUNCTION_NAME"
echo "  - New Endpoint: GET https://$API_ID.execute-api.$REGION.amazonaws.com/prod/developers/games"
echo "  - Existing Endpoints: GET /games, GET /games/{id}, POST /games"
echo "  - Region: $REGION"
echo ""
echo "🧪 Test the new endpoint:"
echo "curl -X GET https://$API_ID.execute-api.$REGION.amazonaws.com/prod/developers/games \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'X-App-Client: developer-portal'"
echo ""