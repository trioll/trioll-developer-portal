#!/bin/bash

echo "🔍 Testing developer profile API..."

# Get the token from browser localStorage
echo "Please copy your developerToken from localStorage and paste it here:"
read -p "Token: " TOKEN

if [ -z "$TOKEN" ]; then
    echo "❌ No token provided"
    exit 1
fi

API_ENDPOINT="https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod"

echo -e "\n1. Testing /developers/profile endpoint..."
curl -X GET "$API_ENDPOINT/developers/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-App-Client: developer-portal" \
  -v 2>&1 | grep -E "(HTTP/|{|})"|head -20

echo -e "\n\n2. Testing /users/profile endpoint..."
curl -X GET "$API_ENDPOINT/users/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "(HTTP/|{|})"|head -20

echo -e "\n\n3. Decoding JWT token to get user info..."
# Extract and decode the JWT payload
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)
# Add padding if needed
PAYLOAD_LENGTH=$((${#PAYLOAD} % 4))
if [ $PAYLOAD_LENGTH -eq 2 ]; then
    PAYLOAD="${PAYLOAD}=="
elif [ $PAYLOAD_LENGTH -eq 3 ]; then
    PAYLOAD="${PAYLOAD}="
fi

echo "Token payload:"
echo $PAYLOAD | base64 -d | jq '.' 2>/dev/null || echo "Failed to decode token"