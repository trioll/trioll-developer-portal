#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FUNCTION_NAME="trioll-prod-users-api"

echo -e "${YELLOW}Updating users API with proper CORS and developer portal support...${NC}"

# First, let's backup the current function
echo "Backing up current function..."
aws lambda get-function --function-name $FUNCTION_NAME --query 'Code.Location' --output text | xargs wget -O backup-users-api.zip 2>/dev/null

# Create deployment package
echo "Creating deployment package..."
cp unified-developers-api.js users-api.js  # Match the handler name
zip deployment.zip users-api.js

# Update the function code
echo "Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip

# Update environment variables to include proper CORS
echo "Updating environment variables..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment Variables="{
        USERS_TABLE=trioll-prod-users,
        USER_POOL_ID=us-east-1_cLPH2acQd,
        CLIENT_ID=5joogquqr4jgukp7mncgp3g23h,
        AWS_REGION=us-east-1,
        ALLOWED_ORIGINS=*
    }" \
    --timeout 30

# Clean up
rm users-api.js deployment.zip

echo -e "${GREEN}Users API updated successfully!${NC}"
echo -e "${YELLOW}Note: ALLOWED_ORIGINS is now set to * for development. In production, you should restrict this.${NC}"