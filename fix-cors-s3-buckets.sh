#!/bin/bash

# Fix S3 bucket CORS configuration for triolldev.com
# This resolves "Failed to fetch" errors when uploading from browser

set -e

echo "🔧 Fixing S3 Bucket CORS Configuration for triolldev.com"
echo "========================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# S3 buckets
GAMES_BUCKET="trioll-prod-games-us-east-1"
UPLOADS_BUCKET="trioll-prod-uploads-us-east-1"

# CORS configuration
CORS_CONFIG=$(cat <<'EOF'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": [
                "https://triolldev.com",
                "https://www.triolldev.com",
                "http://localhost:*",
                "http://127.0.0.1:*"
            ],
            "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF
)

echo "📦 Updating CORS for Games Bucket: $GAMES_BUCKET"
echo "------------------------------------------------"

# Check current CORS
echo -n "Current CORS status: "
if aws s3api get-bucket-cors --bucket $GAMES_BUCKET --region us-east-1 2>/dev/null; then
    echo -e "${YELLOW}Already configured${NC}"
    echo "Do you want to update it? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Skipping games bucket..."
    else
        aws s3api put-bucket-cors --bucket $GAMES_BUCKET --cors-configuration "$CORS_CONFIG" --region us-east-1
        echo -e "${GREEN}✅ CORS updated for $GAMES_BUCKET${NC}"
    fi
else
    echo -e "${RED}Not configured${NC}"
    echo "Adding CORS configuration..."
    aws s3api put-bucket-cors --bucket $GAMES_BUCKET --cors-configuration "$CORS_CONFIG" --region us-east-1
    echo -e "${GREEN}✅ CORS added to $GAMES_BUCKET${NC}"
fi

echo ""
echo "📦 Updating CORS for Uploads Bucket: $UPLOADS_BUCKET"
echo "---------------------------------------------------"

# Check current CORS
echo -n "Current CORS status: "
if aws s3api get-bucket-cors --bucket $UPLOADS_BUCKET --region us-east-1 2>/dev/null; then
    echo -e "${YELLOW}Already configured${NC}"
    echo "Do you want to update it? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Skipping uploads bucket..."
    else
        aws s3api put-bucket-cors --bucket $UPLOADS_BUCKET --cors-configuration "$CORS_CONFIG" --region us-east-1
        echo -e "${GREEN}✅ CORS updated for $UPLOADS_BUCKET${NC}"
    fi
else
    echo -e "${RED}Not configured${NC}"
    echo "Adding CORS configuration..."
    aws s3api put-bucket-cors --bucket $UPLOADS_BUCKET --cors-configuration "$CORS_CONFIG" --region us-east-1
    echo -e "${GREEN}✅ CORS added to $UPLOADS_BUCKET${NC}"
fi

echo ""
echo "🔍 Verifying CORS Configuration..."
echo "=================================="

echo ""
echo "Games Bucket CORS:"
aws s3api get-bucket-cors --bucket $GAMES_BUCKET --region us-east-1 2>/dev/null | jq '.' || echo "No CORS configured"

echo ""
echo "Uploads Bucket CORS:"
aws s3api get-bucket-cors --bucket $UPLOADS_BUCKET --region us-east-1 2>/dev/null | jq '.' || echo "No CORS configured"

echo ""
echo -e "${GREEN}✅ S3 CORS configuration complete!${NC}"
echo ""
echo "📝 Next Steps:"
echo "1. Test file uploads from triolldev.com"
echo "2. Check browser console for CORS errors"
echo "3. If issues persist, check CloudFront settings"