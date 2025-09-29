#!/bin/bash

# Deploy Pre-Token Generation Lambda for Cognito
# This adds developer_id to JWT tokens automatically

set -e  # Exit on error

echo "🚀 Deploying Cognito Pre-Token Generation Lambda..."

# Configuration
FUNCTION_NAME="trioll-prod-pre-token-generation"
ROLE_ARN="arn:aws:iam::561645284740:role/trioll-lambda-role"
REGION="us-east-1"
USER_POOL_ID="us-east-1_cLPH2acQd"
RUNTIME="nodejs18.x"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create deployment package
echo "📦 Creating deployment package..."
rm -f pre-token-lambda.zip
zip -r pre-token-lambda.zip cognito-pre-token-generation-v3.js

# Check if function exists
echo "🔍 Checking if function already exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "📝 Function exists, updating code..."
    
    # Update function code
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://pre-token-lambda.zip \
        --region $REGION
    
    # Update function configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="{USERS_TABLE='trioll-prod-users'}" \
        --timeout 10 \
        --memory-size 256 \
        --region $REGION
else
    echo "🆕 Creating new function..."
    
    # Create function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler cognito-pre-token-generation-v3.handler \
        --zip-file fileb://pre-token-lambda.zip \
        --timeout 10 \
        --memory-size 256 \
        --environment Variables="{USERS_TABLE='trioll-prod-users'}" \
        --region $REGION
fi

echo "${GREEN}✅ Lambda function deployed${NC}"

# Add permission for Cognito to invoke
echo "🔐 Adding Cognito invoke permission..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id CognitoPreTokenGen \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn arn:aws:cognito-idp:$REGION:561645284740:userpool/$USER_POOL_ID \
    --region $REGION 2>/dev/null || true

echo "${GREEN}✅ Permissions configured${NC}"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

echo ""
echo "${GREEN}🎉 Pre-Token Generation Lambda deployed successfully!${NC}"
echo ""
echo "Lambda ARN: $LAMBDA_ARN"
echo ""
echo "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Add this Lambda as a trigger in Cognito User Pool"
echo "2. Run: ./configure-cognito-trigger.sh"
echo "3. Test by logging out and logging back in"
echo ""
echo "To add the trigger manually:"
echo "aws cognito-idp update-user-pool \\"
echo "  --user-pool-id $USER_POOL_ID \\"
echo "  --lambda-config PreTokenGeneration=$LAMBDA_ARN \\"
echo "  --region $REGION"
echo ""

# Clean up
rm -f pre-token-lambda.zip