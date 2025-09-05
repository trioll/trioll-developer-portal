#!/bin/bash

echo "🔧 Setting up Developer API Routes in API Gateway..."

API_ID="4ib0hvu1xj"
REGION="us-east-1"
LAMBDA_ARN="arn:aws:lambda:us-east-1:$(aws sts get-caller-identity --query Account --output text):function:trioll-prod-users-api"

# Get the root resource ID
echo "Getting root resource ID..."
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/`].id' --output text)
echo "Root ID: $ROOT_ID"

# Check if /developers resource exists
DEVELOPERS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/developers`].id' --output text)

if [ -z "$DEVELOPERS_ID" ]; then
    echo "Creating /developers resource..."
    DEVELOPERS_ID=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part developers --region $REGION --query 'id' --output text)
    echo "Created /developers resource with ID: $DEVELOPERS_ID"
else
    echo "/developers resource already exists with ID: $DEVELOPERS_ID"
fi

# Create sub-resources
create_route() {
    local PATH_PART=$1
    local METHOD=$2
    local PARENT_ID=$3
    
    echo "Setting up /$PATH_PART..."
    
    # Check if resource exists
    RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path==\`/developers/$PATH_PART\`].id" --output text)
    
    if [ -z "$RESOURCE_ID" ]; then
        echo "Creating /$PATH_PART resource..."
        RESOURCE_ID=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $PARENT_ID --path-part $PATH_PART --region $REGION --query 'id' --output text)
    fi
    
    echo "Setting up $METHOD method..."
    
    # Create method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type NONE \
        --region $REGION 2>/dev/null
    
    # Set up Lambda integration
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --region $REGION
    
    # Set up CORS
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION 2>/dev/null
    
    # Mock integration for OPTIONS
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --integration-http-method OPTIONS \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION
    
    # OPTIONS method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{
            "method.response.header.Access-Control-Allow-Headers": false,
            "method.response.header.Access-Control-Allow-Methods": false,
            "method.response.header.Access-Control-Allow-Origin": false
        }' \
        --region $REGION
    
    # OPTIONS integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{
            "method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-App-Client'\''",
            "method.response.header.Access-Control-Allow-Methods": "'\''GET,POST,OPTIONS'\''",
            "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"
        }' \
        --region $REGION
    
    echo "✅ $METHOD /developers/$PATH_PART configured"
}

# Create routes
create_route "register" "POST" $DEVELOPERS_ID
create_route "login" "POST" $DEVELOPERS_ID
create_route "profile" "GET" $DEVELOPERS_ID
create_route "games" "GET" $DEVELOPERS_ID

# Grant Lambda permission for API Gateway
echo "Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
    --function-name trioll-prod-users-api \
    --statement-id apigateway-developers-$(date +%s) \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
    --region $REGION 2>/dev/null

echo "
🎉 API routes created successfully!

Next steps:
1. Deploy the API:
   aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION

2. Test the endpoints:
   curl https://$API_ID.execute-api.$REGION.amazonaws.com/prod/developers/register -X OPTIONS -I
"