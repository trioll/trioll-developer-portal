#!/bin/bash

# Fix Lambda handler configuration for trioll-prod-games-api
# This fixes the "Cannot find module 'index'" error

set -e

echo "🔧 Fixing Lambda Handler Configuration"
echo "====================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FUNCTION_NAME="trioll-prod-games-api"
REGION="us-east-1"

echo "📋 Checking current handler configuration..."
CURRENT_HANDLER=$(aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $REGION --query Handler --output text)
echo "Current handler: $CURRENT_HANDLER"

if [ "$CURRENT_HANDLER" == "index.handler" ]; then
    echo -e "${YELLOW}Handler is incorrectly set to 'index.handler'${NC}"
    echo "The actual file is 'games-api.js', so handler should be 'games-api.handler'"
    echo ""
    echo "🔧 Updating handler configuration..."
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --handler "games-api.handler" \
        --region $REGION
    
    echo -e "${GREEN}✅ Handler updated to 'games-api.handler'${NC}"
    
    # Wait for the update to complete
    echo ""
    echo "⏳ Waiting for update to complete..."
    aws lambda wait function-updated \
        --function-name $FUNCTION_NAME \
        --region $REGION
    
    echo -e "${GREEN}✅ Function update complete!${NC}"
else
    echo -e "${GREEN}Handler is already correctly set to: $CURRENT_HANDLER${NC}"
fi

echo ""
echo "📋 Testing the function..."
echo "=========================="

# Test the /games endpoint
echo "Testing GET /games..."
TEST_RESPONSE=$(aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --payload '{"path": "/games", "httpMethod": "GET"}' \
    --region $REGION \
    /tmp/test-response.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda invocation successful${NC}"
    echo "Response:"
    cat /tmp/test-response.json | jq '.' 2>/dev/null || cat /tmp/test-response.json
    rm -f /tmp/test-response.json
else
    echo -e "${RED}❌ Lambda invocation failed${NC}"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Test triolldev.com again - errors should be resolved"
echo "2. Your games should now appear in 'My Games'"
echo "3. Analytics data should populate correctly"