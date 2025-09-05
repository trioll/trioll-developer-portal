#!/bin/bash

# Deploy Multi-Client Lambda Script
# This updates the existing unified-developers-api Lambda to support both mobile app and developer portal

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Multi-Client Lambda Deployment...${NC}"

# Configuration
LAMBDA_NAME="trioll-prod-users-api"
REGION="us-east-1"
BACKEND_DIR="backend-updates"
TEMP_DIR="lambda-deployment-temp"

# Create temporary deployment directory
echo -e "\n${GREEN}1. Creating deployment package...${NC}"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# Copy the multi-client Lambda code
cp $BACKEND_DIR/unified-developers-api-multiclient.js $TEMP_DIR/index.js

# Create package.json
cat > $TEMP_DIR/package.json << EOF
{
  "name": "unified-developers-api",
  "version": "2.0.0",
  "description": "Multi-client authentication API supporting mobile app and developer portal",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1563.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0"
  }
}
EOF

# Install dependencies
echo -e "\n${GREEN}2. Installing dependencies...${NC}"
cd $TEMP_DIR
npm install --production

# Create deployment zip
echo -e "\n${GREEN}3. Creating deployment package...${NC}"
zip -r ../deployment.zip .
cd ..

# Update Lambda function code
echo -e "\n${GREEN}4. Updating Lambda function...${NC}"
aws lambda update-function-code \
    --function-name $LAMBDA_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION

# Update Lambda environment variables to include developer client ID
echo -e "\n${GREEN}5. Updating environment variables...${NC}"
aws lambda update-function-configuration \
    --function-name $LAMBDA_NAME \
    --environment "Variables={
        USERS_TABLE=trioll-prod-users,
        USER_POOL_ID=us-east-1_cLPH2acQd,
        CLIENT_ID=bft50gui77sdq2n4lcio4onql,
        DEVELOPER_CLIENT_ID=5joogquqr4jgukp7mncgp3g23h
    }" \
    --region $REGION

# Wait for configuration update to complete
echo -e "\n${GREEN}6. Waiting for configuration update...${NC}"
aws lambda wait function-updated \
    --function-name $LAMBDA_NAME \
    --region $REGION

# Test the deployment
echo -e "\n${GREEN}7. Testing deployment...${NC}"
echo -e "${YELLOW}Testing developer portal client identification...${NC}"

# Create test event for developer portal
cat > test-event.json << EOF
{
  "path": "/developers/login",
  "httpMethod": "POST",
  "headers": {
    "Content-Type": "application/json",
    "X-App-Client": "developer-portal"
  },
  "body": "{\"email\":\"test@example.com\",\"password\":\"test123\"}"
}
EOF

# Invoke Lambda with test event
aws lambda invoke \
    --function-name $LAMBDA_NAME \
    --payload file://test-event.json \
    --region $REGION \
    response.json

# Check response
if grep -q "developer-portal" response.json || grep -q "5joogquqr4jgukp7mncgp3g23h" response.json; then
    echo -e "${GREEN}✓ Developer portal client ID detection working!${NC}"
else
    echo -e "${YELLOW}⚠ Check CloudWatch logs for client ID detection${NC}"
fi

# Clean up
echo -e "\n${GREEN}8. Cleaning up...${NC}"
rm -rf $TEMP_DIR
rm -f deployment.zip test-event.json response.json

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "\n${YELLOW}What was deployed:${NC}"
echo "• Lambda: $LAMBDA_NAME"
echo "• Region: $REGION"
echo "• Mobile App Client ID: bft50gui77sdq2n4lcio4onql"
echo "• Developer Portal Client ID: 5joogquqr4jgukp3g23h"

echo -e "\n${YELLOW}Test the deployment:${NC}"
echo "1. Go to https://triolldev.com"
echo "2. Try logging in with your developer account"
echo "3. Check the Debug tab for authentication status"
echo "4. Try uploading a game"

echo -e "\n${YELLOW}Monitor logs:${NC}"
echo "aws logs tail /aws/lambda/$LAMBDA_NAME --follow --region $REGION"

echo -e "\n${GREEN}The Lambda now supports both:${NC}"
echo "• Developer Portal (with X-App-Client: developer-portal header)"
echo "• Mobile App (default, no header needed)"