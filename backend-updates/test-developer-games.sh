#!/bin/bash

# Test script for /developers/games endpoint
# Replace YOUR_TOKEN with your actual JWT token

echo "🧪 Testing /developers/games endpoint..."
echo ""

# Test endpoint
API_URL="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/games"

# Get token from command line argument or prompt
if [ -z "$1" ]; then
    echo "Please provide your JWT token as an argument:"
    echo "Usage: ./test-developer-games.sh YOUR_JWT_TOKEN"
    echo ""
    echo "You can get your token from the triolldev.com debug panel"
    exit 1
fi

TOKEN=$1

echo "📡 Making request to: $API_URL"
echo ""

# Make the request
response=$(curl -s -X GET "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-App-Client: developer-portal" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

# Extract HTTP status code
http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:.*//')

# Pretty print response
echo "📊 Response Status: $http_code"
echo ""
echo "📄 Response Body:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

# Check if successful
if [ "$http_code" = "200" ]; then
    echo "✅ Success! Endpoint is working correctly"
    
    # Extract game count if available
    game_count=$(echo "$body" | jq '.games | length' 2>/dev/null)
    if [ ! -z "$game_count" ] && [ "$game_count" != "null" ]; then
        echo "📊 Found $game_count games for this developer"
    fi
else
    echo "❌ Error: HTTP $http_code"
    echo "Please check:"
    echo "  - Your JWT token is valid"
    echo "  - You're logged in as a developer (not regular user)"
    echo "  - The token includes developerId in custom attributes"
fi