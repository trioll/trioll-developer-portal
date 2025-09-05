#!/bin/bash

# Deploy Unified Developers API Lambda
# This version handles both email-based and userId-based DynamoDB schemas

FUNCTION_NAME="trioll-prod-users-api"
REGION="us-east-1"

echo "🚀 Deploying Unified Developers API..."
echo "This will fix the 500 error on /developers/profile endpoint"
echo ""

# Check if Lambda function exists
echo "📋 Checking if Lambda function exists..."
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Lambda function $FUNCTION_NAME not found!"
    echo "Please create it first or check the function name"
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
rm -rf temp-unified-deploy
mkdir -p temp-unified-deploy

# Copy the unified API file
cp unified-developers-api.js temp-unified-deploy/index.js

# Create minimal package.json
cat > temp-unified-deploy/package.json << EOF
{
  "name": "trioll-developers-api",
  "version": "1.0.0",
  "dependencies": {
    "aws-sdk": "2.1062.0",
    "bcryptjs": "2.4.3",
    "jsonwebtoken": "9.0.0"
  }
}
EOF

# Install dependencies
cd temp-unified-deploy
echo "📥 Installing dependencies..."
npm install --production

# Create ZIP file
echo "🗜️ Creating ZIP package..."
zip -r ../unified-developers-api.zip .

# Upload to Lambda
cd ..
echo "⬆️ Uploading to Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://unified-developers-api.zip \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed!"
else
    echo "❌ Deployment failed!"
    exit 1
fi

# Update environment variables
echo "🔧 Updating environment variables..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment Variables="{USERS_TABLE=trioll-prod-users,USER_POOL_ID=us-east-1_cLPH2acQd,CLIENT_ID=bft50gui77sdq2n4lcio4onql}" \
    --region $REGION \
    --timeout 30 \
    --memory-size 512

# Clean up
echo "🧹 Cleaning up..."
rm -rf temp-unified-deploy
rm unified-developers-api.zip

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 What this fixes:"
echo "  - Handles both email-based and userId-based DynamoDB schemas"
echo "  - Automatically creates developer profiles if missing"
echo "  - Works for all users, not just specific emails"
echo "  - Provides detailed error logging"
echo ""
echo "🧪 Test the fix:"
echo "  1. Go to https://www.triolldev.com"
echo "  2. Login with your credentials"
echo "  3. Go to Debug tab"
echo "  4. Click 'Test Profile Endpoint'"
echo "  5. Should now return 200 with your developer info"
echo ""
echo "⚠️ Important: Make sure API Gateway routes /developers/* to this Lambda"