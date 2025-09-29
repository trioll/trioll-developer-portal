#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FUNCTION_NAME="trioll-prod-games-api"

echo -e "${YELLOW}Deploying games API with full CORS support...${NC}"

# Check if AWS SDK v3 packages are installed
if [ ! -d "node_modules/@aws-sdk" ]; then
    echo "Installing AWS SDK v3 packages..."
    npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
fi

# Create deployment package
echo "Creating deployment package..."
cp games-api-cors-fixed.js games-api.js  # Match the handler name
zip -r deployment.zip games-api.js node_modules package.json package-lock.json

# Update the function code
echo "Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip

# Wait for function to be ready
echo "Waiting for function to be ready..."
sleep 5

# Clean up
rm games-api.js deployment.zip

echo -e "${GREEN}Games API deployed with full CORS support!${NC}"
echo -e "${GREEN}CORS headers now include: X-Guest-Mode, X-Identity-Id, X-Platform, X-App-Source, X-App-Client${NC}"