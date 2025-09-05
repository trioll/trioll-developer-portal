#!/bin/bash

# Add API Gateway routes for comments API

API_ID="4ib0hvu1xj"
REGION="us-east-1"
LAMBDA_ARN="arn:aws:lambda:us-east-1:561645284740:function:trioll-prod-comments-api"

echo "🔗 Adding API Gateway routes for comments..."

# Get the games resource ID (we already know it)
GAMES_RESOURCE_ID="ewej61"

# 1. Create {gameId} path variable under /games if it doesn't exist
echo "Creating /games/{gameId} resource..."
GAME_ID_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $GAMES_RESOURCE_ID \
    --path-part "{gameId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null)

if [ -z "$GAME_ID_RESOURCE" ]; then
    # If creation failed, try to get existing resource
    GAME_ID_RESOURCE=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?parentId=='$GAMES_RESOURCE_ID' && pathPart=='{gameId}'].id | [0]" \
        --output text)
fi

echo "Game ID resource: $GAME_ID_RESOURCE"

# 2. Create /games/{gameId}/comments resource
echo "Creating /games/{gameId}/comments resource..."
GAME_COMMENTS_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $GAME_ID_RESOURCE \
    --path-part "comments" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null)

if [ -z "$GAME_COMMENTS_RESOURCE" ]; then
    GAME_COMMENTS_RESOURCE=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?parentId=='$GAME_ID_RESOURCE' && pathPart=='comments'].id | [0]" \
        --output text)
fi

echo "Game comments resource: $GAME_COMMENTS_RESOURCE"

# 3. Create /comments resource at root
echo "Creating /comments resource..."
ROOT_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/'].id | [0]" \
    --output text)

COMMENTS_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part "comments" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null)

if [ -z "$COMMENTS_RESOURCE" ]; then
    COMMENTS_RESOURCE=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?parentId=='$ROOT_ID' && pathPart=='comments'].id | [0]" \
        --output text)
fi

echo "Comments resource: $COMMENTS_RESOURCE"

# 4. Create /comments/{commentId} resource
echo "Creating /comments/{commentId} resource..."
COMMENT_ID_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $COMMENTS_RESOURCE \
    --path-part "{commentId}" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null)

if [ -z "$COMMENT_ID_RESOURCE" ]; then
    COMMENT_ID_RESOURCE=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?parentId=='$COMMENTS_RESOURCE' && pathPart=='{commentId}'].id | [0]" \
        --output text)
fi

echo "Comment ID resource: $COMMENT_ID_RESOURCE"

# 5. Create /comments/{commentId}/like resource
echo "Creating /comments/{commentId}/like resource..."
LIKE_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $COMMENT_ID_RESOURCE \
    --path-part "like" \
    --region $REGION \
    --query 'id' \
    --output text 2>/dev/null)

if [ -z "$LIKE_RESOURCE" ]; then
    LIKE_RESOURCE=$(aws apigateway get-resources \
        --rest-api-id $API_ID \
        --region $REGION \
        --query "items[?parentId=='$COMMENT_ID_RESOURCE' && pathPart=='like'].id | [0]" \
        --output text)
fi

echo "Like resource: $LIKE_RESOURCE"

# Function to create method and integration
create_method() {
    local RESOURCE_ID=$1
    local METHOD=$2
    local PATH_DESC=$3
    
    echo "Adding $METHOD method to $PATH_DESC..."
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --region $REGION > /dev/null 2>&1
    
    # Create integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --region $REGION > /dev/null 2>&1
    
    # Add CORS support
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --status-code 200 \
        --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":true}" \
        --region $REGION > /dev/null 2>&1
}

# Add methods to each resource
echo ""
echo "🔨 Adding methods..."

# GET and POST /games/{gameId}/comments
create_method $GAME_COMMENTS_RESOURCE "GET" "/games/{gameId}/comments"
create_method $GAME_COMMENTS_RESOURCE "POST" "/games/{gameId}/comments"
create_method $GAME_COMMENTS_RESOURCE "OPTIONS" "/games/{gameId}/comments"

# PUT and DELETE /comments/{commentId}
create_method $COMMENT_ID_RESOURCE "PUT" "/comments/{commentId}"
create_method $COMMENT_ID_RESOURCE "DELETE" "/comments/{commentId}"
create_method $COMMENT_ID_RESOURCE "OPTIONS" "/comments/{commentId}"

# PUT /comments/{commentId}/like
create_method $LIKE_RESOURCE "PUT" "/comments/{commentId}/like"
create_method $LIKE_RESOURCE "OPTIONS" "/comments/{commentId}/like"

# Grant Lambda permissions for API Gateway
echo ""
echo "🔐 Adding Lambda permissions..."

# Generate unique statement IDs
TIMESTAMP=$(date +%s)

for PATH in "game-comments-get" "game-comments-post" "comment-update" "comment-delete" "comment-like"; do
    aws lambda add-permission \
        --function-name trioll-prod-comments-api \
        --statement-id "apigateway-${PATH}-${TIMESTAMP}" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:561645284740:$API_ID/*/*/*" \
        --region $REGION > /dev/null 2>&1
done

# Deploy API
echo ""
echo "🚀 Deploying API..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION > /dev/null

echo ""
echo "✅ Comments API routes added successfully!"
echo ""
echo "📍 Endpoints created:"
echo "   GET    https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{gameId}/comments"
echo "   POST   https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{gameId}/comments"
echo "   PUT    https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/comments/{commentId}"
echo "   DELETE https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/comments/{commentId}"
echo "   PUT    https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/comments/{commentId}/like"