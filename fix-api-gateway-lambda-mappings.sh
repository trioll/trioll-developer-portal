#!/bin/bash

# Fix API Gateway Lambda mappings to use correct functions
# This will resolve the "Failed to fetch" errors on triolldev.com

set -e

echo "🔧 Fixing API Gateway Lambda Mappings"
echo "====================================="
echo ""

# Configuration
API_ID="4ib0hvu1xj"
REGION="us-east-1"
STAGE="prod"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "⚠️  This script will update API Gateway to use the correct Lambda functions"
echo "This fixes the issue where old Lambda functions are serving API requests"
echo ""
echo "Continue? (y/n)"
read -r response
if [[ "$response" != "y" ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📋 Getting current Lambda function ARNs..."
echo "========================================="

# Get Lambda function ARNs
GAMES_API_ARN=$(aws lambda get-function --function-name trioll-prod-games-api --region $REGION --query 'Configuration.FunctionArn' --output text)
INTERACTIONS_API_ARN=$(aws lambda get-function --function-name trioll-prod-interactions-api --region $REGION --query 'Configuration.FunctionArn' --output text)

echo "Games API ARN: $GAMES_API_ARN"
echo "Interactions API ARN: $INTERACTIONS_API_ARN"

# Function to update integration
update_integration() {
    local path=$1
    local method=$2
    local lambda_arn=$3
    local resource_id=$4
    
    echo ""
    echo "Updating: $method $path"
    echo "  Resource ID: $resource_id"
    echo "  New Lambda: $(basename $lambda_arn)"
    
    # Update the integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method $method \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${lambda_arn}/invocations" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✅ Integration updated${NC}"
    else
        echo -e "${RED}  ❌ Failed to update integration${NC}"
        return 1
    fi
}

echo ""
echo "🔍 Finding resources to update..."
echo "================================"

# Get all resources
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --limit 500 --output json)

# Extract resource IDs for paths we need to fix
GAMES_ROOT_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games") | .id')
GAMES_ID_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}") | .id')
LIKES_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/likes") | .id')
PLAYS_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/plays") | .id')
RATINGS_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/ratings") | .id')

echo "Found resource IDs:"
echo "  /games: $GAMES_ROOT_ID"
echo "  /games/{gameId}: $GAMES_ID_ID"
echo "  /games/{gameId}/likes: $LIKES_ID"
echo "  /games/{gameId}/plays: $PLAYS_ID"
echo "  /games/{gameId}/ratings: $RATINGS_ID"

echo ""
echo "🚀 Updating Lambda integrations..."
echo "================================="

# Update GET /games to use trioll-prod-games-api (not get-games)
if [ ! -z "$GAMES_ROOT_ID" ]; then
    update_integration "/games" "GET" "$GAMES_API_ARN" "$GAMES_ROOT_ID"
fi

# Update GET /games/{gameId} to use trioll-prod-games-api (not staging-games-api)
if [ ! -z "$GAMES_ID_ID" ]; then
    update_integration "/games/{gameId}" "GET" "$GAMES_API_ARN" "$GAMES_ID_ID"
fi

# Update GET methods for interactions to use trioll-prod-interactions-api
if [ ! -z "$LIKES_ID" ]; then
    update_integration "/games/{gameId}/likes" "GET" "$INTERACTIONS_API_ARN" "$LIKES_ID"
fi

if [ ! -z "$PLAYS_ID" ]; then
    update_integration "/games/{gameId}/plays" "GET" "$INTERACTIONS_API_ARN" "$PLAYS_ID"
fi

if [ ! -z "$RATINGS_ID" ]; then
    update_integration "/games/{gameId}/ratings" "GET" "$INTERACTIONS_API_ARN" "$RATINGS_ID"
fi

echo ""
echo "🔄 Deploying changes to prod stage..."
echo "===================================="

# Create deployment
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE \
    --description "Fix Lambda mappings for correct functions" \
    --region $REGION \
    --query 'id' \
    --output text)

if [ ! -z "$DEPLOYMENT_ID" ]; then
    echo -e "${GREEN}✅ Deployment created: $DEPLOYMENT_ID${NC}"
    echo -e "${GREEN}✅ Changes are now LIVE!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""
echo "📊 Verification Steps:"
echo "===================="
echo "1. Test triolldev.com - the 'Failed to fetch' errors should be resolved"
echo "2. Check the Debug tab to verify API connectivity"
echo "3. Test game loading in both list and detail views"
echo ""
echo "🎯 What was fixed:"
echo "- GET /games now uses trioll-prod-games-api (was: trioll-prod-get-games)"
echo "- GET /games/{id} now uses trioll-prod-games-api (was: trioll-staging-games-api)"
echo "- GET interaction endpoints now use trioll-prod-interactions-api (was: old counter functions)"
echo ""
echo -e "${GREEN}✅ API Gateway Lambda mappings updated successfully!${NC}"