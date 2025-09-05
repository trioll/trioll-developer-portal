#!/bin/bash

# Deploy the comments API Lambda function

FUNCTION_NAME="trioll-prod-comments-api"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::561645284740:role/trioll-lambda-execution-role"

echo "📦 Creating deployment package for comments API..."

# Create a temporary directory
mkdir -p temp-comments-deploy
cd temp-comments-deploy

# Copy the Lambda code
cp ../comments-api.js index.js

# Install required dependencies
npm init -y > /dev/null 2>&1
npm install aws-sdk uuid jsonwebtoken > /dev/null 2>&1

# Create deployment zip
zip -r deployment.zip . > /dev/null

echo "📤 Creating Lambda function..."

# Create the Lambda function
aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --timeout 30 \
    --memory-size 256 \
    --zip-file fileb://deployment.zip \
    --region $REGION \
    --environment Variables="{
        COMMENTS_TABLE=trioll-prod-comments,
        GAMES_TABLE=trioll-prod-games,
        USERS_TABLE=trioll-prod-users
    }" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Lambda function created successfully!"
else
    echo "⚠️  Function might already exist, trying to update..."
    
    # Update the function code if it already exists
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment.zip \
        --region $REGION > /dev/null
    
    # Update configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables="{
            COMMENTS_TABLE=trioll-prod-comments,
            GAMES_TABLE=trioll-prod-games,
            USERS_TABLE=trioll-prod-users
        }" > /dev/null
    
    echo "✅ Lambda function updated successfully!"
fi

echo "🧹 Cleaning up..."
cd ..
rm -rf temp-comments-deploy

echo ""
echo "📝 Lambda function '$FUNCTION_NAME' is ready!"
echo ""
echo "Next steps:"
echo "1. Add API Gateway routes for:"
echo "   - GET /games/{gameId}/comments"
echo "   - POST /games/{gameId}/comments"
echo "   - PUT /comments/{commentId}"
echo "   - DELETE /comments/{commentId}"
echo "   - PUT /comments/{commentId}/like"