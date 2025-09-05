#!/bin/bash

# Test Script for Developer Authentication

echo "🧪 Testing Developer Authentication Flow"
echo "========================================"

API_URL="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test data
TEST_EMAIL="developer$(date +%s)@test.com"
TEST_PASSWORD="TestPass123!"
TEST_COMPANY="Test Game Studio $(date +%s)"

echo -e "\n${YELLOW}1. Testing Developer Registration${NC}"
echo "Email: $TEST_EMAIL"
echo "Company: $TEST_COMPANY"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/developers/register" \
    -H "Content-Type: application/json" \
    -H "Origin: https://triolldev.com" \
    -H "X-App-Client: developer-portal" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"companyName\": \"$TEST_COMPANY\",
        \"website\": \"https://testgames.com\"
    }")

echo "Response:"
echo "$REGISTER_RESPONSE" | jq . || echo "$REGISTER_RESPONSE"

# Extract developerId if successful
DEVELOPER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.developerId // empty')

if [ -n "$DEVELOPER_ID" ]; then
    echo -e "${GREEN}✓ Registration successful! Developer ID: $DEVELOPER_ID${NC}"
else
    echo -e "${RED}✗ Registration failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}2. Testing Developer Login${NC}"
echo "Note: Email verification required. For testing, you can:"
echo "1. Check your email for verification code"
echo "2. Use AWS Console to confirm the user"
echo "3. Skip to next test"

# Note: Login will fail until email is verified
echo -e "\n${YELLOW}Login test (will fail if not verified):${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/developers/login" \
    -H "Content-Type: application/json" \
    -H "Origin: https://triolldev.com" \
    -H "X-App-Client: developer-portal" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

echo "Response:"
echo "$LOGIN_RESPONSE" | jq . || echo "$LOGIN_RESPONSE"

echo -e "\n${YELLOW}3. Testing CORS Headers${NC}"
CORS_TEST=$(curl -s -I -X OPTIONS "$API_URL/developers/register" \
    -H "Origin: https://triolldev.com" \
    -H "Access-Control-Request-Method: POST")

echo "$CORS_TEST" | grep -i "access-control" || echo "No CORS headers found"

echo -e "\n${YELLOW}4. Testing Game Upload Auth (without token - should fail)${NC}"
GAME_TEST=$(curl -s -X POST "$API_URL/games" \
    -H "Content-Type: application/json" \
    -H "Origin: https://triolldev.com" \
    -d "{
        \"gameId\": \"test-game-123\",
        \"name\": \"Test Game\",
        \"description\": \"Test\",
        \"category\": \"Action\",
        \"developer\": \"$TEST_COMPANY\",
        \"deviceOrientation\": \"Both\",
        \"controlStyle\": \"Tap & Swipe Only\",
        \"gameStage\": \"Pre-release (Feature Testing)\",
        \"deviceCompatibility\": [\"Mobile iOS\"],
        \"gameUrl\": \"https://test.com/game\",
        \"thumbnailUrl\": \"https://test.com/thumb.png\"
    }")

echo "Response:"
echo "$GAME_TEST" | jq . || echo "$GAME_TEST"

echo -e "\n${GREEN}========================================"
echo "Test Summary:"
echo "- Developer Registration: Created $DEVELOPER_ID"
echo "- Login: Requires email verification"
echo "- CORS: Check output above"
echo "- Game Upload: Requires auth token"
echo "========================================${NC}"

echo -e "\n${YELLOW}To verify the user in AWS Console:${NC}"
echo "1. Go to Cognito User Pools"
echo "2. Select 'us-east-1_cLPH2acQd'"
echo "3. Go to Users and groups"
echo "4. Find $TEST_EMAIL"
echo "5. Click 'Confirm user'"
echo "6. Add to 'developers' group"