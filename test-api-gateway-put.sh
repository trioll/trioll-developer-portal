#!/bin/bash

# Test PUT endpoint on API Gateway directly
# This tests if the route is properly configured

API_ENDPOINT="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod"

echo "Testing OPTIONS request first (for CORS)..."
curl -X OPTIONS "${API_ENDPOINT}/games/test-game-123" \
  -H "Origin: https://triolldev.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control)"

echo -e "\n\nTesting PUT request..."
curl -X PUT "${API_ENDPOINT}/games/test-game-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -H "X-App-Client: developer-portal" \
  -d '{"name":"Test Game Update","description":"Testing PUT endpoint"}' \
  -v 2>&1 | tail -20

echo -e "\n\nChecking if Lambda is being invoked..."
aws logs tail /aws/lambda/trioll-prod-games-update-api --since 5m --region us-east-1 | head -20