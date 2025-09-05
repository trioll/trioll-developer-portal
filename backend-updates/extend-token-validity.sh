#!/bin/bash

# Script to extend token validity for better developer experience
# This will set tokens to 2 hours instead of 1 hour default

USER_POOL_ID="us-east-1_cLPH2acQd"
CLIENT_ID="5joogquqr4jgukp7mncgp3g23h"  # Developer portal client
REGION="us-east-1"

echo "🔐 Extending token validity for developer portal..."
echo ""

# Update the user pool client with extended token validity
echo "📝 Updating Cognito client settings..."
aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --access-token-validity 2 \
  --id-token-validity 2 \
  --token-validity-units "AccessToken=hours,IdToken=hours,RefreshToken=days" \
  --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ Successfully updated token validity!"
    echo ""
    echo "New token lifespans:"
    echo "- ID Token: 2 hours (was 1 hour)"
    echo "- Access Token: 2 hours (was 1 hour)"
    echo "- Refresh Token: 30 days (unchanged)"
    echo ""
    echo "This will apply to all new logins."
else
    echo "❌ Failed to update token validity"
    exit 1
fi

# Get current settings to confirm
echo "📋 Current token settings:"
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --region $REGION \
  --query 'UserPoolClient.[AccessTokenValidity,IdTokenValidity,RefreshTokenValidity,TokenValidityUnits]' \
  --output json