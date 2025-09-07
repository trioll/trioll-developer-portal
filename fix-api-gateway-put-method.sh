#!/bin/bash

# Fix API Gateway PUT method for game updates
# This script updates the CORS configuration and ensures PUT method is properly integrated

set -e

echo "🔧 Fixing API Gateway PUT method configuration..."

# Configuration
API_ID="4ib0hvu1xj"
REGION="us-east-1"
STAGE="prod"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📍 API Gateway: $API_ID"
echo "📍 Region: $REGION"
echo "📍 Stage: $STAGE"
echo ""

# Step 1: Get the resource ID for /games/{gameId}
echo "🔍 Finding /games/{gameId} resource..."
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
    --query "items[?path=='/games/{gameId}'].id" --output text)

if [ -z "$RESOURCE_ID" ]; then
    echo "${RED}❌ Error: /games/{gameId} resource not found${NC}"
    exit 1
fi

echo "${GREEN}✅ Found resource: $RESOURCE_ID${NC}"

# Step 2: Check if PUT method exists
echo "🔍 Checking if PUT method exists..."
if aws apigateway get-method --rest-api-id $API_ID --resource-id $RESOURCE_ID \
    --http-method PUT --region $REGION 2>/dev/null; then
    echo "${GREEN}✅ PUT method exists${NC}"
else
    echo "${YELLOW}⚠️  PUT method not found, creating it...${NC}"
    
    # Create PUT method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method PUT \
        --authorization-type NONE \
        --region $REGION
    
    # Configure Lambda integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method PUT \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:trioll-prod-games-update-api/invocations" \
        --region $REGION
fi

# Step 3: Update OPTIONS method to include PUT in CORS headers
echo "🔧 Updating OPTIONS method for CORS..."

# First, delete existing integration response if it exists
aws apigateway delete-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --region $REGION 2>/dev/null || true

# Delete existing method response if it exists
aws apigateway delete-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --region $REGION 2>/dev/null || true

# Update method response with CORS headers including PUT
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
    --region $REGION

# Update integration response to include PUT in allowed methods
aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-App-Client'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION

echo "${GREEN}✅ CORS configuration updated${NC}"

# Step 4: Add Lambda permission if needed
echo "🔐 Ensuring Lambda has API Gateway permission..."
aws lambda add-permission \
    --function-name trioll-prod-games-update-api \
    --statement-id "apigateway-put-${RESOURCE_ID}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/PUT/games/*" \
    --region $REGION 2>/dev/null || true

# Step 5: Deploy changes to prod stage
echo "🚀 Deploying changes to $STAGE stage..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE \
    --description "Enable PUT method for game updates" \
    --region $REGION \
    --query 'id' \
    --output text)

echo "${GREEN}✅ Deployment created: $DEPLOYMENT_ID${NC}"

# Step 6: Test the endpoint
echo ""
echo "🧪 Testing the updated endpoint..."
echo "Testing OPTIONS request..."
OPTIONS_RESPONSE=$(curl -s -X OPTIONS "https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE/games/test-game" -I)
echo "$OPTIONS_RESPONSE" | grep -i "access-control-allow-methods" || echo "No CORS headers found"

echo ""
echo "${GREEN}✅ API Gateway configuration complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - API ID: $API_ID"
echo "  - Resource: /games/{gameId}"
echo "  - Methods: GET, POST, PUT, DELETE, OPTIONS"
echo "  - CORS: Enabled with PUT method"
echo "  - Lambda: trioll-prod-games-update-api"
echo ""
echo "🧪 To test the game update functionality:"
echo "1. Get a valid token from your logged-in session"
echo "2. Run this command:"
echo ""
echo "curl -X PUT https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE/games/{gameId} \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'X-App-Client: developer-portal' \\"
echo "  -d '{\"name\":\"Updated Game Name\",\"description\":\"New description\"}'"
echo ""