#!/bin/bash

# Add Developer Routes to API Gateway

echo "🔧 Adding Developer Routes to API Gateway..."
echo "==========================================="

# Configuration
API_ID="4ib0hvu1xj"
REGION="us-east-1"
LAMBDA_ARN="arn:aws:lambda:us-east-1:561645284740:function:trioll-prod-users-api"
GAMES_LAMBDA_ARN="arn:aws:lambda:us-east-1:561645284740:function:trioll-prod-get-games"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get root resource ID
echo -e "${YELLOW}Getting API Gateway root resource...${NC}"
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/") | .id')
echo "Root ID: $ROOT_ID"

# Create /developers resource
echo -e "\n${YELLOW}Creating /developers resource...${NC}"
DEVELOPERS_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part developers \
    --region $REGION 2>&1) || echo "Resource might already exist"

DEVELOPERS_ID=$(echo $DEVELOPERS_RESOURCE | jq -r '.id' || aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/developers") | .id')
echo "Developers Resource ID: $DEVELOPERS_ID"

# Function to create method
create_method() {
    local RESOURCE_ID=$1
    local METHOD=$2
    local PATH=$3
    
    echo -e "${YELLOW}Creating $METHOD method for $PATH...${NC}"
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --region $REGION || echo "Method might already exist"
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --region $REGION
    
    # Create method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --status-code 200 \
        --response-models '{"application/json": "Empty"}' \
        --region $REGION
}

# Create /developers/register
echo -e "\n${YELLOW}Creating /developers/register...${NC}"
REGISTER_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $DEVELOPERS_ID \
    --path-part register \
    --region $REGION 2>&1) || echo "Resource might already exist"

REGISTER_ID=$(echo $REGISTER_RESOURCE | jq -r '.id' || aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/developers/register") | .id')
create_method $REGISTER_ID "POST" "/developers/register"
create_method $REGISTER_ID "OPTIONS" "/developers/register"

# Create /developers/login
echo -e "\n${YELLOW}Creating /developers/login...${NC}"
LOGIN_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $DEVELOPERS_ID \
    --path-part login \
    --region $REGION 2>&1) || echo "Resource might already exist"

LOGIN_ID=$(echo $LOGIN_RESOURCE | jq -r '.id' || aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/developers/login") | .id')
create_method $LOGIN_ID "POST" "/developers/login"
create_method $LOGIN_ID "OPTIONS" "/developers/login"

# Create /developers/profile
echo -e "\n${YELLOW}Creating /developers/profile...${NC}"
PROFILE_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $DEVELOPERS_ID \
    --path-part profile \
    --region $REGION 2>&1) || echo "Resource might already exist"

PROFILE_ID=$(echo $PROFILE_RESOURCE | jq -r '.id' || aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/developers/profile") | .id')
create_method $PROFILE_ID "GET" "/developers/profile"
create_method $PROFILE_ID "PUT" "/developers/profile"
create_method $PROFILE_ID "OPTIONS" "/developers/profile"

# Create /developers/games with games-api integration
echo -e "\n${YELLOW}Creating /developers/games...${NC}"
GAMES_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $DEVELOPERS_ID \
    --path-part games \
    --region $REGION 2>&1) || echo "Resource might already exist"

GAMES_ID=$(echo $GAMES_RESOURCE | jq -r '.id' || aws apigateway get-resources --rest-api-id $API_ID --region $REGION | jq -r '.items[] | select(.path == "/developers/games") | .id')

# Special handling for games endpoint - uses different Lambda
echo -e "${YELLOW}Creating GET method for /developers/games (games-api)...${NC}"
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $GAMES_ID \
    --http-method GET \
    --authorization-type NONE \
    --region $REGION || echo "Method might already exist"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $GAMES_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$GAMES_LAMBDA_ARN/invocations" \
    --region $REGION

# Add Lambda permissions
echo -e "\n${YELLOW}Adding Lambda invoke permissions...${NC}"

# For users-api
ENDPOINTS=("register" "login" "profile")
for ENDPOINT in "${ENDPOINTS[@]}"; do
    aws lambda add-permission \
        --function-name trioll-prod-users-api \
        --statement-id "apigateway-developers-$ENDPOINT-$(date +%s)" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:561645284740:$API_ID/*/POST/developers/$ENDPOINT" \
        --region $REGION 2>&1 || echo "Permission might already exist"
done

# For games-api
aws lambda add-permission \
    --function-name trioll-prod-get-games \
    --statement-id "apigateway-developers-games-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:561645284740:$API_ID/*/GET/developers/games" \
    --region $REGION 2>&1 || echo "Permission might already exist"

# Deploy API
echo -e "\n${YELLOW}Deploying API to prod stage...${NC}"
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Added developer endpoints" \
    --region $REGION

echo -e "\n${GREEN}✅ API Gateway routes added successfully!${NC}"
echo ""
echo "New endpoints available:"
echo "- POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/register"
echo "- POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/login"
echo "- GET  https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/profile"
echo "- PUT  https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/profile"
echo "- GET  https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/games"