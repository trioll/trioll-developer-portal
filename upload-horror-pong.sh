#!/bin/bash

# Upload Horror Pong game directly to S3 and register in database

echo "🎮 Uploading Horror Pong to Trioll Platform"
echo "=========================================="

# Configuration
GAME_ID="horror-pong-$(date +%s)"
BUCKET="trioll-prod-games-us-east-1"
REGION="us-east-1"
GAME_FOLDER="/Users/frederickcaplin/Desktop/new iphone game"
DEVELOPER_ID="dev_freddi"
API_ENDPOINT="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod"

echo "📁 Game ID: $GAME_ID"
echo ""

# Upload files to S3
echo "📤 Uploading files to S3..."

# Upload the HTML file as index.html
aws s3 cp "$GAME_FOLDER/horror_pong_game.html" "s3://$BUCKET/$GAME_ID/index.html" \
    --region $REGION \
    --content-type "text/html" \
    --cache-control "public, max-age=3600"

if [ $? -eq 0 ]; then
    echo "✅ HTML uploaded"
else
    echo "❌ Failed to upload HTML"
    exit 1
fi

# Upload the thumbnail
aws s3 cp "$GAME_FOLDER/Horror Pong Thumbnail.png" "s3://$BUCKET/$GAME_ID/thumbnail.png" \
    --region $REGION \
    --content-type "image/png" \
    --cache-control "public, max-age=86400"

if [ $? -eq 0 ]; then
    echo "✅ Thumbnail uploaded"
else
    echo "❌ Failed to upload thumbnail"
fi

# Get the CloudFront URL
CLOUDFRONT_URL="https://dgq2nqysbn2z3.cloudfront.net"
GAME_URL="$CLOUDFRONT_URL/$GAME_ID/index.html"
THUMBNAIL_URL="$CLOUDFRONT_URL/$GAME_ID/thumbnail.png"

echo ""
echo "🌐 Game URL: $GAME_URL"
echo "🖼️  Thumbnail: $THUMBNAIL_URL"

# Register game in database
echo ""
echo "📝 Registering game in database..."

# Get your auth token (you'll need to provide this)
echo ""
echo "⚠️  IMPORTANT: You need to be logged in to the developer portal"
echo "Please enter your auth token from the browser (check localStorage):"
echo "1. Open browser console (F12)"
echo "2. Type: localStorage.getItem('developerToken')"
echo "3. Copy the token (without quotes)"
echo ""
read -p "Auth token: " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ No token provided. Game uploaded to S3 but not registered in database."
    echo "You can still access it at: $GAME_URL"
    exit 0
fi

# Create the game record
GAME_DATA=$(cat <<EOF
{
    "gameId": "$GAME_ID",
    "title": "Horror Pong",
    "name": "Horror Pong",
    "category": "Arcade",
    "description": "A spooky twist on the classic Pong game! Battle against horrifying opponents in this dark arcade experience.",
    "developer": "Freddie Caplin",
    "developerId": "$DEVELOPER_ID",
    "deviceOrientation": "both",
    "controlStyle": "touchscreen",
    "gameStage": "production",
    "deviceCompatibility": ["Mobile", "Tablet"],
    "gameUrl": "$GAME_URL",
    "thumbnailUrl": "$THUMBNAIL_URL",
    "s3Folder": "$GAME_ID",
    "status": "active",
    "publishedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
)

# Post to API
RESPONSE=$(curl -X POST "$API_ENDPOINT/games" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$GAME_DATA" \
    -s -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Game registered successfully!"
    echo ""
    echo "🎉 Horror Pong is now live!"
    echo "Game URL: $GAME_URL"
    echo "Game ID: $GAME_ID"
else
    echo "❌ Failed to register game (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    echo ""
    echo "⚠️  Game is uploaded to S3 but not in database"
    echo "You can still play it at: $GAME_URL"
fi

echo ""
echo "📱 To test in Trioll Mobile app:"
echo "1. Open the app"
echo "2. Pull to refresh the games list"
echo "3. Horror Pong should appear!"