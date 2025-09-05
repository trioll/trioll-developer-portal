#!/bin/bash

# Update the trioll-prod-users-api Lambda function with enhanced developer ID support

FUNCTION_NAME="trioll-prod-users-api"
REGION="us-east-1"

echo "📦 Creating deployment package..."

# Create a temporary directory
mkdir -p temp-lambda-deploy
cd temp-lambda-deploy

# Copy the enhanced Lambda code
cp ../developers-api-enhanced.js index.js

# Install required dependencies
npm init -y > /dev/null 2>&1
npm install bcryptjs jsonwebtoken aws-sdk > /dev/null 2>&1

# Create deployment zip
zip -r deployment.zip . > /dev/null

echo "📤 Updating Lambda function..."

# Update the Lambda function code
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deployment.zip \
    --region $REGION

echo "⚙️  Updating environment variables..."

# Update environment variables
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --environment Variables="{
        USERS_TABLE=trioll-prod-users,
        GAMES_TABLE=trioll-prod-games,
        USER_POOL_ID=us-east-1_cLPH2acQd,
        CLIENT_ID=5joogquqr4jgukp7mncgp3g23h,
        JWT_SECRET=trioll-jwt-secret-2024
    }" \
    --timeout 30 \
    --memory-size 256

echo "🧹 Cleaning up..."
cd ..
rm -rf temp-lambda-deploy

echo "✅ Lambda function updated successfully!"
echo ""
echo "🔍 Testing the endpoints..."

# Test if the profile endpoint is working
echo "Testing /developers/profile endpoint..."
curl -s -o /dev/null -w "%{http_code}" https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/profile

echo ""
echo "📝 Note: The Lambda function has been updated with:"
echo "  - Developer ID generation with incremental numbering"
echo "  - Auto-confirmation for unverified users"
echo "  - Profile endpoint support"
echo "  - Games tracking by developer"