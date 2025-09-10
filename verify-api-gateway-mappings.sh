#!/bin/bash

# Verify current API Gateway Lambda mappings
# Shows which Lambda functions are actually serving each endpoint

set -e

echo "🔍 Verifying API Gateway Lambda Mappings"
echo "========================================"
echo ""

# Configuration
API_ID="4ib0hvu1xj"
REGION="us-east-1"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check integration
check_integration() {
    local path=$1
    local method=$2
    local resource_id=$3
    
    echo ""
    echo "Checking: $method $path"
    
    # Get the integration
    INTEGRATION=$(aws apigateway get-integration \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method $method \
        --region $REGION 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$INTEGRATION" == "NOT_FOUND" ]; then
        echo -e "  ${RED}❌ No integration found${NC}"
        return
    fi
    
    # Extract Lambda function name from URI
    URI=$(echo "$INTEGRATION" | jq -r '.uri // "none"')
    if [ "$URI" != "none" ]; then
        LAMBDA_NAME=$(echo "$URI" | grep -oP 'function:\K[^/]+' || echo "unknown")
        
        # Color code based on whether it's the correct function
        if [[ "$path" == "/games" && "$method" == "GET" ]]; then
            if [[ "$LAMBDA_NAME" == "trioll-prod-games-api" ]]; then
                echo -e "  Lambda: ${GREEN}$LAMBDA_NAME ✅ (correct)${NC}"
            else
                echo -e "  Lambda: ${RED}$LAMBDA_NAME ❌ (should be trioll-prod-games-api)${NC}"
            fi
        elif [[ "$path" == "/games/{gameId}" && "$method" == "GET" ]]; then
            if [[ "$LAMBDA_NAME" == "trioll-prod-games-api" ]]; then
                echo -e "  Lambda: ${GREEN}$LAMBDA_NAME ✅ (correct)${NC}"
            else
                echo -e "  Lambda: ${RED}$LAMBDA_NAME ❌ (should be trioll-prod-games-api)${NC}"
            fi
        elif [[ "$path" =~ "/games/{gameId}/(likes|plays|ratings)" && "$method" == "GET" ]]; then
            if [[ "$LAMBDA_NAME" == "trioll-prod-interactions-api" ]]; then
                echo -e "  Lambda: ${GREEN}$LAMBDA_NAME ✅ (correct)${NC}"
            else
                echo -e "  Lambda: ${RED}$LAMBDA_NAME ❌ (should be trioll-prod-interactions-api)${NC}"
            fi
        else
            echo -e "  Lambda: ${YELLOW}$LAMBDA_NAME${NC}"
        fi
    fi
}

echo "📋 Getting API resources..."
echo "=========================="

# Get all resources
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --limit 500 --output json)

# Critical endpoints to check
echo ""
echo "🎯 Critical Endpoints Status:"
echo "============================"

# GET /games
GAMES_ROOT_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games") | .id')
if [ ! -z "$GAMES_ROOT_ID" ]; then
    check_integration "/games" "GET" "$GAMES_ROOT_ID"
fi

# GET /games/{gameId}
GAMES_ID_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}") | .id')
if [ ! -z "$GAMES_ID_ID" ]; then
    check_integration "/games/{gameId}" "GET" "$GAMES_ID_ID"
fi

# Interaction endpoints
LIKES_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/likes") | .id')
if [ ! -z "$LIKES_ID" ]; then
    check_integration "/games/{gameId}/likes" "GET" "$LIKES_ID"
fi

PLAYS_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/plays") | .id')
if [ ! -z "$PLAYS_ID" ]; then
    check_integration "/games/{gameId}/plays" "GET" "$PLAYS_ID"
fi

RATINGS_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path == "/games/{gameId}/ratings") | .id')
if [ ! -z "$RATINGS_ID" ]; then
    check_integration "/games/{gameId}/ratings" "GET" "$RATINGS_ID"
fi

echo ""
echo "📊 Summary:"
echo "=========="
echo "If you see ❌ marks above, run:"
echo "  ./fix-api-gateway-lambda-mappings.sh"
echo ""
echo "This will update the API Gateway to use the correct Lambda functions."