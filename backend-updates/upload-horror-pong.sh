#!/bin/bash

# Upload Horror Pong game files to S3
# This script uploads the game HTML and thumbnail to the existing game folder

set -e

echo "🎮 Uploading Horror Pong game files to S3..."

# Configuration
GAME_ID="horror-pong-1757087555176"
BUCKET="trioll-prod-games-us-east-1"
REGION="us-east-1"

# File paths
GAME_HTML="/Users/frederickcaplin/Desktop/horror_pong_game.html"
THUMBNAIL="/Users/frederickcaplin/Desktop/horror-pong-thumbnail (1).png"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📍 Game ID: $GAME_ID"
echo "📍 S3 Bucket: $BUCKET"
echo ""

# Check if files exist
if [ ! -f "$GAME_HTML" ]; then
    echo "${RED}❌ Game HTML file not found: $GAME_HTML${NC}"
    exit 1
fi

if [ ! -f "$THUMBNAIL" ]; then
    echo "${RED}❌ Thumbnail file not found: $THUMBNAIL${NC}"
    exit 1
fi

echo "${GREEN}✅ Files found${NC}"

# Upload game HTML as index.html
echo ""
echo "📤 Uploading game HTML..."
aws s3 cp "$GAME_HTML" "s3://$BUCKET/$GAME_ID/index.html" \
    --region $REGION \
    --content-type "text/html" \

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Game HTML uploaded successfully${NC}"
else
    echo "${RED}❌ Failed to upload game HTML${NC}"
    exit 1
fi

# Upload thumbnail as both thumbnail.png and thumbnail.svg (since DB expects .svg)
echo ""
echo "📤 Uploading thumbnail..."
aws s3 cp "$THUMBNAIL" "s3://$BUCKET/$GAME_ID/thumbnail.png" \
    --region $REGION \
    --content-type "image/png" \

# Also copy as .svg since that's what's in the database
aws s3 cp "$THUMBNAIL" "s3://$BUCKET/$GAME_ID/thumbnail.svg" \
    --region $REGION \
    --content-type "image/png" \

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Thumbnail uploaded successfully${NC}"
else
    echo "${RED}❌ Failed to upload thumbnail${NC}"
    exit 1
fi

# List uploaded files
echo ""
echo "📋 Verifying uploaded files..."
aws s3 ls "s3://$BUCKET/$GAME_ID/" --region $REGION

echo ""
echo "${GREEN}✅ Horror Pong upload complete!${NC}"
echo ""
echo "🌐 Game URLs:"
echo "  Game: https://dgq2nqysbn2z3.cloudfront.net/$GAME_ID/index.html"
echo "  Thumbnail: https://dgq2nqysbn2z3.cloudfront.net/$GAME_ID/thumbnail.png"
echo ""
echo "The game should now be playable in the Trioll app!"