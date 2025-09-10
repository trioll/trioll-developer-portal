#!/bin/bash

# Check API Gateway CORS configuration for triolldev.com
# This script diagnoses CORS issues causing "Failed to fetch" errors

set -e

API_ID="4ib0hvu1xj"
REGION="us-east-1"

echo "🔍 Checking API Gateway CORS Configuration..."
echo "============================================"
echo ""

# Check if API Gateway has CORS enabled
echo "📋 Checking CORS on key endpoints..."

# Function to check CORS for a specific resource
check_cors_for_resource() {
    local path=$1
    local resource_id=$2
    
    echo ""
    echo "Checking: $path"
    
    # Check if OPTIONS method exists
    if aws apigateway get-method \
        --rest-api-id $API_ID \
        --resource-id $resource_id \
        --http-method OPTIONS \
        --region $REGION 2>/dev/null >/dev/null; then
        
        echo "✅ OPTIONS method exists"
        
        # Get the integration response to see CORS headers
        CORS_HEADERS=$(aws apigateway get-integration-response \
            --rest-api-id $API_ID \
            --resource-id $resource_id \
            --http-method OPTIONS \
            --status-code 200 \
            --region $REGION 2>/dev/null | jq -r '.responseParameters')
            
        if [[ "$CORS_HEADERS" == *"Access-Control-Allow-Origin"* ]]; then
            echo "✅ CORS headers configured"
            echo "   Headers: $CORS_HEADERS"
        else
            echo "❌ CORS headers NOT configured properly"
        fi
    else
        echo "❌ No OPTIONS method - CORS not enabled!"
    fi
}

# Get all API resources
echo "Fetching API resources..."
RESOURCES=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query 'items[?path==`/games` || path==`/developers/games` || path==`/developers/profile`].[path,id]' \
    --output json)

echo "$RESOURCES" | jq -r '.[] | @tsv' | while IFS=$'\t' read -r path resource_id; do
    check_cors_for_resource "$path" "$resource_id"
done

echo ""
echo "📋 Checking API Gateway deployment stage..."
STAGE_INFO=$(aws apigateway get-stage \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION 2>/dev/null)

echo "Stage: prod"
echo "Last deployment: $(echo "$STAGE_INFO" | jq -r '.deploymentId')"

echo ""
echo "🔧 To fix CORS issues, run:"
echo "aws apigateway update-integration-response \\"
echo "    --rest-api-id $API_ID \\"
echo "    --resource-id RESOURCE_ID \\"
echo "    --http-method OPTIONS \\"
echo "    --status-code 200 \\"
echo "    --patch-operations \\"
echo "    'op=replace,path=/responseParameters/method.response.header.Access-Control-Allow-Origin,value=\"'\"'*'\"'\"'"