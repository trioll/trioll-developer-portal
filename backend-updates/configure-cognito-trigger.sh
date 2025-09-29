#!/bin/bash

# Configure Cognito User Pool to use Pre-Token Generation Lambda
# This must be run after deploying the Lambda function

set -e

echo "🔧 Configuring Cognito Pre-Token Generation Trigger..."

# Configuration
REGION="us-east-1"
USER_POOL_ID="us-east-1_cLPH2acQd"
FUNCTION_NAME="trioll-prod-pre-token-generation"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get Lambda ARN
echo "📍 Getting Lambda ARN..."
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text 2>/dev/null)

if [ -z "$LAMBDA_ARN" ]; then
    echo "${RED}❌ Lambda function not found. Please run deploy-pre-token-lambda.sh first${NC}"
    exit 1
fi

echo "Lambda ARN: $LAMBDA_ARN"

# Get current user pool configuration
echo "📥 Getting current user pool configuration..."
CURRENT_CONFIG=$(aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID --region $REGION --query 'UserPool.LambdaConfig' --output json)

echo "Current Lambda Config:"
echo "$CURRENT_CONFIG" | jq '.'

# Update user pool with pre-token generation trigger
echo "🔄 Updating user pool Lambda configuration..."

# Build Lambda config with existing triggers
LAMBDA_CONFIG=$(echo "$CURRENT_CONFIG" | jq --arg arn "$LAMBDA_ARN" '. + {PreTokenGeneration: $arn}')

# Update the user pool
aws cognito-idp update-user-pool \
    --user-pool-id $USER_POOL_ID \
    --lambda-config "$LAMBDA_CONFIG" \
    --region $REGION

echo "${GREEN}✅ Cognito trigger configured successfully!${NC}"

# Verify configuration
echo ""
echo "🔍 Verifying configuration..."
NEW_CONFIG=$(aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID --region $REGION --query 'UserPool.LambdaConfig.PreTokenGeneration' --output text)

if [ "$NEW_CONFIG" = "$LAMBDA_ARN" ]; then
    echo "${GREEN}✅ Pre-Token Generation trigger is active${NC}"
    echo "Trigger ARN: $NEW_CONFIG"
else
    echo "${RED}❌ Configuration verification failed${NC}"
    exit 1
fi

echo ""
echo "${GREEN}🎉 Configuration complete!${NC}"
echo ""
echo "${YELLOW}Testing Instructions:${NC}"
echo "1. Log out of the developer portal"
echo "2. Log back in"
echo "3. Check the debug-token-claims.html page"
echo "4. You should see custom:developer_id in your token"
echo ""
echo "To remove the trigger (if needed):"
echo "aws cognito-idp update-user-pool --user-pool-id $USER_POOL_ID --lambda-config '{}' --region $REGION"