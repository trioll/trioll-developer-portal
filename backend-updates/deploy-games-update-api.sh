#!/bin/bash

# Deploy Script for Games Update API Lambda Function
# This script packages and deploys the PUT /games/{gameId} endpoint

set -e  # Exit on error

echo "🚀 Starting deployment of Games Update API Lambda..."

# Configuration
FUNCTION_NAME="trioll-prod-games-update-api"
REGION="us-east-1"
RUNTIME="nodejs20.x"
HANDLER="games-update-api.handler"
TIMEOUT=30
MEMORY=256

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create temporary directory for deployment package
echo "📦 Creating deployment package..."
TEMP_DIR=$(mktemp -d)
cp games-update-api.js $TEMP_DIR/

# Create package.json for Lambda dependencies
cat > $TEMP_DIR/package.json << 'EOF'
{
  "name": "games-update-api",
  "version": "1.0.0",
  "description": "Lambda function for updating game metadata",
  "main": "games-update-api.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.614.0",
    "@aws-sdk/lib-dynamodb": "^3.614.0",
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.1.0"
  }
}
EOF

# Install dependencies
echo "📥 Installing dependencies..."
cd $TEMP_DIR
npm install --production

# Create ZIP file
echo "🗜️  Creating deployment ZIP..."
zip -r deployment.zip .

# Check if Lambda function exists
echo "🔍 Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "${YELLOW}⚠️  Function exists. Updating code...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment.zip \
        --region $REGION
    
    echo "${GREEN}✅ Lambda function code updated${NC}"
else
    echo "${YELLOW}⚠️  Function doesn't exist. Creating new function...${NC}"
    
    # Create IAM role for Lambda (if it doesn't exist)
    ROLE_NAME="trioll-games-update-lambda-role"
    ROLE_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/$ROLE_NAME"
    
    # Check if role exists
    if ! aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
        echo "Creating IAM role..."
        
        # Create trust policy
        cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
        
        # Create role
        aws iam create-role \
            --role-name $ROLE_NAME \
            --assume-role-policy-document file://trust-policy.json
        
        # Attach basic Lambda execution policy
        aws iam attach-role-policy \
            --role-name $ROLE_NAME \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        # Create and attach DynamoDB policy
        cat > dynamodb-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/trioll-prod-games"
    }
  ]
}
EOF
        
        aws iam put-role-policy \
            --role-name $ROLE_NAME \
            --policy-name DynamoDBAccess \
            --policy-document file://dynamodb-policy.json
        
        echo "Waiting for role to be ready..."
        sleep 10
    fi
    
    # Create Lambda function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://deployment.zip \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --region $REGION
    
    echo "${GREEN}✅ Lambda function created${NC}"
fi

# Configure API Gateway
echo "🔧 Configuring API Gateway..."

# Get API Gateway ID
API_ID="4ib0hvu1xj"
API_NAME="trioll-prod-api"

# Check if resource exists for /games/{gameId}
RESOURCE_PATH="/games/{gameId}"
PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
    --query "items[?path=='/games'].id" --output text)

if [ -z "$PARENT_ID" ]; then
    echo "${RED}❌ Error: /games resource not found in API Gateway${NC}"
    exit 1
fi

# Check if {gameId} resource exists
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION \
    --query "items[?path=='$RESOURCE_PATH'].id" --output text)

if [ -z "$RESOURCE_ID" ]; then
    echo "Creating resource {gameId}..."
    RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $PARENT_ID \
        --path-part "{gameId}" \
        --region $REGION \
        --query 'id' \
        --output text)
fi

# Check if PUT method exists
if ! aws apigateway get-method --rest-api-id $API_ID --resource-id $RESOURCE_ID \
    --http-method PUT --region $REGION 2>/dev/null; then
    
    echo "Creating PUT method..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method PUT \
        --authorization-type NONE \
        --region $REGION
    
    # Configure Lambda integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method PUT \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME/invocations" \
        --region $REGION
    
    # Add Lambda permission for API Gateway
    aws lambda add-permission \
        --function-name $FUNCTION_NAME \
        --statement-id apigateway-put-games \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
        --region $REGION 2>/dev/null || true
fi

# Configure OPTIONS method for CORS
if ! aws apigateway get-method --rest-api-id $API_ID --resource-id $RESOURCE_ID \
    --http-method OPTIONS --region $REGION 2>/dev/null; then
    
    echo "Creating OPTIONS method for CORS..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION
    
    # Configure mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --integration-http-method OPTIONS \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # Configure method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":true,"method.response.header.Access-Control-Allow-Methods":true,"method.response.header.Access-Control-Allow-Origin":true}' \
        --region $REGION
    
    # Configure integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-App-Client'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'PUT,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --region $REGION
fi

# Deploy API Gateway
echo "🚀 Deploying API Gateway..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION

# Clean up
echo "🧹 Cleaning up..."
rm -rf $TEMP_DIR

echo ""
echo "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - Lambda Function: $FUNCTION_NAME"
echo "  - API Endpoint: PUT https://$API_ID.execute-api.$REGION.amazonaws.com/prod/games/{gameId}"
echo "  - Region: $REGION"
echo ""
echo "🧪 Test the endpoint:"
echo "curl -X PUT https://$API_ID.execute-api.$REGION.amazonaws.com/prod/games/test-game-id \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'X-App-Client: developer-portal' \\"
echo "  -d '{\"name\":\"Updated Game\",\"description\":\"Updated description\"}'"
echo ""