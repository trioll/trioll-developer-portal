#!/bin/bash

# Test script to verify Cognito custom attributes are working

echo "🔍 Testing Cognito Custom Attributes Setup"
echo "=========================================="

# Configuration
USER_POOL_ID="us-east-1_cLPH2acQd"
REGION="us-east-1"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get user email
if [ -z "$1" ]; then
    echo "Usage: ./test-custom-attributes.sh <email>"
    echo "Example: ./test-custom-attributes.sh freddiecaplin@hotmail.com"
    exit 1
fi

EMAIL="$1"

echo ""
echo "Testing for user: $EMAIL"
echo ""

# Step 1: Check if user exists in Cognito
echo "1️⃣ Checking if user exists in Cognito..."
USER_DATA=$(aws cognito-idp admin-get-user \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL" \
    --region $REGION 2>&1)

if echo "$USER_DATA" | grep -q "UserNotFoundException"; then
    echo "${RED}❌ User not found in Cognito${NC}"
    exit 1
else
    echo "${GREEN}✅ User found in Cognito${NC}"
fi

# Step 2: Check custom attributes
echo ""
echo "2️⃣ Checking custom attributes..."

# Extract custom attributes
DEVELOPER_ID=$(echo "$USER_DATA" | jq -r '.UserAttributes[] | select(.Name=="custom:developer_id") | .Value' 2>/dev/null)
USER_TYPE=$(echo "$USER_DATA" | jq -r '.UserAttributes[] | select(.Name=="custom:user_type") | .Value' 2>/dev/null)
COMPANY_NAME=$(echo "$USER_DATA" | jq -r '.UserAttributes[] | select(.Name=="custom:company_name") | .Value' 2>/dev/null)

echo ""
echo "Custom Attributes Found:"
echo "------------------------"

if [ -n "$DEVELOPER_ID" ] && [ "$DEVELOPER_ID" != "null" ]; then
    echo "${GREEN}✅ custom:developer_id = $DEVELOPER_ID${NC}"
else
    echo "${RED}❌ custom:developer_id = NOT SET${NC}"
fi

if [ -n "$USER_TYPE" ] && [ "$USER_TYPE" != "null" ]; then
    echo "${GREEN}✅ custom:user_type = $USER_TYPE${NC}"
else
    echo "${YELLOW}⚠️  custom:user_type = NOT SET${NC}"
fi

if [ -n "$COMPANY_NAME" ] && [ "$COMPANY_NAME" != "null" ]; then
    echo "${GREEN}✅ custom:company_name = $COMPANY_NAME${NC}"
else
    echo "${YELLOW}⚠️  custom:company_name = NOT SET${NC}"
fi

# Step 3: Check Pre-Token Lambda trigger
echo ""
echo "3️⃣ Checking Pre-Token Generation trigger..."

TRIGGER=$(aws cognito-idp describe-user-pool \
    --user-pool-id $USER_POOL_ID \
    --region $REGION \
    --query 'UserPool.LambdaConfig.PreTokenGeneration' \
    --output text 2>/dev/null)

if [ -n "$TRIGGER" ] && [ "$TRIGGER" != "None" ]; then
    echo "${GREEN}✅ Pre-Token trigger configured${NC}"
    echo "   Lambda: $TRIGGER"
else
    echo "${RED}❌ Pre-Token trigger NOT configured${NC}"
fi

# Summary
echo ""
echo "📊 Summary:"
echo "-----------"

if [ -n "$DEVELOPER_ID" ] && [ "$DEVELOPER_ID" != "null" ] && [ -n "$TRIGGER" ] && [ "$TRIGGER" != "None" ]; then
    echo "${GREEN}✅ Everything is configured correctly!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Log out of the developer portal"
    echo "2. Log back in"
    echo "3. Your token will now include custom:developer_id"
else
    echo "${YELLOW}⚠️  Setup incomplete${NC}"
    echo ""
    echo "To fix:"
    
    if [ -z "$DEVELOPER_ID" ] || [ "$DEVELOPER_ID" = "null" ]; then
        echo "- Run: node migrate-user-attributes.js --user $EMAIL"
    fi
    
    if [ -z "$TRIGGER" ] || [ "$TRIGGER" = "None" ]; then
        echo "- Run: ./deploy-pre-token-lambda.sh"
        echo "- Run: ./configure-cognito-trigger.sh"
    fi
fi

echo ""