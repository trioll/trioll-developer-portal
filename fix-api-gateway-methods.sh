#!/bin/bash

# Fix API Gateway Method Integrations

echo "🔧 Fixing API Gateway Method Integrations..."
echo "==========================================="

# Configuration
API_ID="4ib0hvu1xj"
REGION="us-east-1"
ACCOUNT_ID="561645284740"
LAMBDA_ARN="arn:aws:lambda:us-east-1:561645284740:function:trioll-prod-users-api"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to create complete method with integration
create_complete_method() {
    local RESOURCE_ID=$1
    local METHOD=$2
    local PATH=$3
    
    echo -e "${YELLOW}Setting up $METHOD $PATH...${NC}"
    
    # Delete existing method if it exists
    aws apigateway delete-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --region $REGION 2>/dev/null || true
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --api-key-required false \
        --region $REGION
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --region $REGION
    
    # Add method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --status-code 200 \
        --response-models '{"application/json": "Empty"}' \
        --region $REGION
    
    # Add integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --status-code 200 \
        --selection-pattern "" \
        --region $REGION
    
    echo -e "${GREEN}✓ $METHOD $PATH configured${NC}"
}

# Fix /developers/register
echo -e "\n${YELLOW}Fixing /developers/register...${NC}"
REGISTER_ID="tidxgh"
create_complete_method $REGISTER_ID "POST" "/developers/register"

# Fix /developers/login
echo -e "\n${YELLOW}Fixing /developers/login...${NC}"
LOGIN_ID="ish42h"
create_complete_method $LOGIN_ID "POST" "/developers/login"

# Fix /developers/profile
echo -e "\n${YELLOW}Fixing /developers/profile...${NC}"
PROFILE_ID="ajivn0"
create_complete_method $PROFILE_ID "GET" "/developers/profile"
create_complete_method $PROFILE_ID "PUT" "/developers/profile"

# Add Lambda permissions for all endpoints
echo -e "\n${YELLOW}Adding Lambda permissions...${NC}"

# Remove old permissions and add new ones
STATEMENT_ID="apigateway-developers-all-$(date +%s)"
aws lambda add-permission \
    --function-name trioll-prod-users-api \
    --statement-id "$STATEMENT_ID" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*/developers/*" \
    --region $REGION || echo "Permission might already exist"

# Deploy API
echo -e "\n${YELLOW}Deploying API...${NC}"
DEPLOYMENT=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Fixed developer endpoints" \
    --region $REGION)

DEPLOYMENT_ID=$(echo $DEPLOYMENT | jq -r '.id')
echo -e "${GREEN}✓ API deployed with ID: $DEPLOYMENT_ID${NC}"

echo -e "\n${GREEN}==================================================
✅ API Gateway Methods Fixed!
==================================================${NC}"
echo ""
echo "Test the endpoints:"
echo "curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"companyName\":\"Test Studio\"}'"