#!/bin/bash

EMAIL="freddiecaplin@hotmail.com"
USER_POOL_ID="us-east-1_cLPH2acQd"

echo "🔧 Manually confirming user: $EMAIL"

# Confirm the user
aws cognito-idp admin-confirm-sign-up \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL" \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ User confirmed successfully!"
    echo "You should now be able to log in with your password."
else
    echo "❌ Failed to confirm user. Checking user status..."
    
    # Check user status
    aws cognito-idp admin-get-user \
        --user-pool-id $USER_POOL_ID \
        --username "$EMAIL" \
        --region us-east-1 \
        --query 'UserStatus' \
        --output text
fi