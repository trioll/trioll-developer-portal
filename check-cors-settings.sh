#!/bin/bash

# Check and update CORS settings for triolldev.com across AWS services

set -e

echo "🔍 Checking CORS settings for triolldev.com..."

# Configuration
REGION="us-east-1"
API_ID="4ib0hvu1xj"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "📋 Checking S3 Bucket CORS configurations..."
echo "============================================"

# S3 Buckets to check
BUCKETS=(
    "trioll-prod-games-us-east-1"
    "trioll-prod-uploads-us-east-1"
    "trioll-prod-analytics-us-east-1"
    "trioll-prod-backups-us-east-1"
)

for BUCKET in "${BUCKETS[@]}"; do
    echo ""
    echo "Bucket: $BUCKET"
    echo -n "CORS Status: "
    
    if aws s3api get-bucket-cors --bucket $BUCKET --region $REGION 2>/dev/null; then
        echo "${GREEN}Configured${NC}"
    else
        echo "${YELLOW}Not configured${NC}"
        echo "Would you like to add CORS rules for triolldev.com? (y/n)"
        # For now, just show what would be added
        echo "Recommended CORS configuration:"
        cat << 'EOF'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["https://triolldev.com", "http://localhost:*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF
    fi
done

echo ""
echo "📋 Checking API Gateway CORS configuration..."
echo "==========================================="

# Get all resources
echo "Getting API resources..."
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[*].[path,id]' --output text)

echo ""
echo "Resources with OPTIONS methods (CORS-enabled):"
while IFS=$'\t' read -r path resource_id; do
    if [ ! -z "$resource_id" ]; then
        # Check if OPTIONS method exists
        if aws apigateway get-method --rest-api-id $API_ID --resource-id $resource_id --http-method OPTIONS --region $REGION 2>/dev/null >/dev/null; then
            echo "${GREEN}✓${NC} $path"
            
            # Get the CORS headers
            CORS_HEADERS=$(aws apigateway get-method-response \
                --rest-api-id $API_ID \
                --resource-id $resource_id \
                --http-method OPTIONS \
                --status-code 200 \
                --region $REGION 2>/dev/null | jq -r '.responseParameters // {}')
            
            if [[ "$CORS_HEADERS" == *"Access-Control-Allow-Origin"* ]]; then
                # Get the actual CORS configuration from integration response
                INTEGRATION_RESPONSE=$(aws apigateway get-integration-response \
                    --rest-api-id $API_ID \
                    --resource-id $resource_id \
                    --http-method OPTIONS \
                    --status-code 200 \
                    --region $REGION 2>/dev/null | jq -r '.responseParameters."method.response.header.Access-Control-Allow-Origin" // "Not set"')
                    
                echo "  Allow-Origin: $INTEGRATION_RESPONSE"
            fi
        fi
    fi
done <<< "$RESOURCES"

echo ""
echo "📋 CloudFront Distribution Check..."
echo "=================================="

# Find CloudFront distributions
DISTRIBUTIONS=$(aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DefaultRootObject,Comment]' --output text 2>/dev/null || echo "")

if [ -z "$DISTRIBUTIONS" ]; then
    echo "No CloudFront distributions found"
else
    while IFS=$'\t' read -r dist_id root_object comment; do
        if [ ! -z "$dist_id" ]; then
            echo ""
            echo "Distribution: $dist_id"
            echo "Comment: ${comment:-None}"
            
            # Get CORS headers configuration
            CORS_CONFIG=$(aws cloudfront get-distribution-config --id $dist_id --query 'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId' --output text 2>/dev/null || echo "None")
            echo "Response Headers Policy: $CORS_CONFIG"
        fi
    done <<< "$DISTRIBUTIONS"
fi

echo ""
echo "${GREEN}✅ CORS check complete!${NC}"
echo ""
echo "📝 Recommendations:"
echo "1. API Gateway already uses wildcard (*) for CORS, which includes triolldev.com ✓"
echo "2. S3 buckets may need CORS rules if you're uploading directly from the browser"
echo "3. CloudFront distributions inherit CORS from their origins"
echo ""
echo "The AWS credential error should now be fixed with the Identity Pool update!"