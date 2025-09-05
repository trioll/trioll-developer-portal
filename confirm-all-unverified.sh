#!/bin/bash

USER_POOL_ID="us-east-1_cLPH2acQd"

echo "🔍 Finding all unverified developer accounts..."

# List all users with UNCONFIRMED status
aws cognito-idp list-users \
    --user-pool-id $USER_POOL_ID \
    --filter 'cognito:user_status="UNCONFIRMED"' \
    --region us-east-1 \
    --query 'Users[].Username' \
    --output text | while read -r username; do
    
    if [ ! -z "$username" ]; then
        echo "Confirming user: $username"
        aws cognito-idp admin-confirm-sign-up \
            --user-pool-id $USER_POOL_ID \
            --username "$username" \
            --region us-east-1
        
        if [ $? -eq 0 ]; then
            echo "✅ $username confirmed"
        else
            echo "❌ Failed to confirm $username"
        fi
    fi
done

echo "✅ All unverified users have been processed"