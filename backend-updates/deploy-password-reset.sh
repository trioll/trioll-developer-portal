#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function name
FUNCTION_NAME="trioll-prod-developers-password-reset"
HANDLER="developers-password-reset.handler"

echo -e "${YELLOW}Deploying password reset functionality...${NC}"

# Create deployment package
echo "Creating deployment package..."
cp developers-password-reset.js index.js
zip deployment.zip index.js

# Check if function exists
echo "Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
    echo -e "${YELLOW}Function exists. Updating code...${NC}"
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment.zip
else
    echo -e "${YELLOW}Function does not exist. Creating new function...${NC}"
    
    # Get the execution role ARN (assuming it follows the pattern)
    ROLE_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role"
    
    # Create the function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://deployment.zip \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables="{CLIENT_ID=5joogquqr4jgukp7mncgp3g23h}"
fi

# Clean up
rm index.js deployment.zip

echo -e "${GREEN}Password reset Lambda deployment complete!${NC}"

# Add API Gateway routes
echo -e "${YELLOW}Adding API Gateway routes...${NC}"

# Get API Gateway ID
API_ID="4ib0hvu1xj"
PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/developers'].id" --output text)

if [ -z "$PARENT_ID" ]; then
    echo -e "${RED}Error: /developers resource not found${NC}"
    exit 1
fi

# Create forgot-password resource
echo "Creating /developers/forgot-password resource..."
FORGOT_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_ID \
    --path-part "forgot-password" \
    --query 'id' \
    --output text 2>/dev/null || \
    aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/developers/forgot-password'].id" --output text)

# Create reset-password resource
echo "Creating /developers/reset-password resource..."
RESET_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_ID \
    --path-part "reset-password" \
    --query 'id' \
    --output text 2>/dev/null || \
    aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/developers/reset-password'].id" --output text)

# Add methods for forgot-password
for METHOD in POST OPTIONS; do
    echo "Adding $METHOD method to /developers/forgot-password..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $FORGOT_RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --no-cli-pager 2>/dev/null || echo "Method $METHOD already exists"
    
    # Add integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $FORGOT_RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME/invocations" \
        --no-cli-pager 2>/dev/null
done

# Add methods for reset-password
for METHOD in POST OPTIONS; do
    echo "Adding $METHOD method to /developers/reset-password..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESET_RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --no-cli-pager 2>/dev/null || echo "Method $METHOD already exists"
    
    # Add integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESET_RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME/invocations" \
        --no-cli-pager 2>/dev/null
done

# Grant API Gateway permission to invoke Lambda
echo "Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-forgot-password \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:us-east-1:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*/developers/forgot-password" \
    2>/dev/null || echo "Permission already exists"

aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-reset-password \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:us-east-1:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*/developers/reset-password" \
    2>/dev/null || echo "Permission already exists"

# Deploy API changes
echo "Deploying API Gateway changes..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Added password reset endpoints"

echo -e "${GREEN}API Gateway routes configured successfully!${NC}"
echo -e "${GREEN}Password reset functionality is now available at:${NC}"
echo "  POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/forgot-password"
echo "  POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/reset-password"