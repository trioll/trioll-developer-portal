#!/bin/bash

# Deploy updated users-api Lambda with Cognito attribute support

set -e

echo "🚀 Deploying updated users-api Lambda..."

# Configuration
FUNCTION_NAME="trioll-prod-users-api"
REGION="us-east-1"
HANDLER="users-api-with-cognito-attributes.handler"

# Create deployment package
echo "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
cp users-api-with-cognito-attributes.js $TEMP_DIR/
cp package.json $TEMP_DIR/

# Install dependencies
echo "📥 Installing dependencies..."
cd $TEMP_DIR
npm install --production @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-cognito-identity-provider

# Create ZIP
echo "🗜️ Creating deployment ZIP..."
zip -r deployment.zip .

# Update Lambda function code
echo "🔄 Updating Lambda function code..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION

# Update handler
echo "📝 Updating Lambda handler..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --handler $HANDLER \
    --region $REGION

# Clean up
cd - > /dev/null
rm -rf $TEMP_DIR

echo "✅ Deployment complete!"
echo ""
echo "🧪 Ready to test the updated authentication flow"