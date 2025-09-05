#!/bin/bash

# Redeploy the original users-api with developers support

FUNCTION_NAME="trioll-prod-users-api"
REGION="us-east-1"

echo "📦 Creating deployment package with original code..."

# Create a temporary directory
mkdir -p temp-lambda-redeploy
cd temp-lambda-redeploy

# Copy the original Lambda code
cp ../users-api-with-developers.js index.js

# Install required dependencies
npm init -y > /dev/null 2>&1
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-cognito-identity-provider > /dev/null 2>&1

# Create deployment zip
zip -r deployment.zip . > /dev/null

echo "📤 Updating Lambda function with original code..."

# Update the Lambda function code
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION \
    --query "LastUpdateStatus" \
    --output text

echo "⏳ Waiting for update to complete..."
sleep 5

# Check status
STATUS=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query "Configuration.LastUpdateStatus" --output text)
echo "Update status: $STATUS"

echo "🧹 Cleaning up..."
cd ..
rm -rf temp-lambda-redeploy

echo "✅ Lambda function restored with developer support!"