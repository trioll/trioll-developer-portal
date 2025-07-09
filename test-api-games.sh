#!/bin/bash

# Test script to verify the games API is working
echo "Testing Trioll Games API..."
echo "=========================="
echo ""

API_URL="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games"

echo "Fetching games from: $API_URL"
echo ""

# Make the API call
response=$(curl -s "$API_URL")

# Check if we got a response
if [ -z "$response" ]; then
    echo "❌ No response from API"
    exit 1
fi

# Pretty print the JSON response
echo "API Response:"
echo "-------------"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

# Count games
game_count=$(echo "$response" | jq '.data | length' 2>/dev/null || echo "0")
echo ""
echo "Total games found: $game_count"

# List game titles
echo ""
echo "Game Titles:"
echo "------------"
echo "$response" | jq -r '.data[]? | "- \(.title // .name // "Untitled") (ID: \(.id))"' 2>/dev/null || echo "Unable to parse games"

echo ""
echo "✅ API test complete!"