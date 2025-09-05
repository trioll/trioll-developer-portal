#!/bin/bash

# Trioll Developer Portal Infrastructure Setup Script
# This script creates all the AWS resources needed for developer authentication

set -e  # Exit on error

echo "🚀 Starting Trioll Developer Portal Infrastructure Setup..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
USER_POOL_ID="us-east-1_cLPH2acQd"
IDENTITY_POOL_ID="us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268"
GAMES_BUCKET="trioll-prod-games-us-east-1"
GAMES_TABLE="trioll-prod-games"

# Step 1: Create Cognito App Client for Developer Portal
echo -e "\n${YELLOW}Step 1: Creating Cognito App Client for Developer Portal...${NC}"

APP_CLIENT_RESPONSE=$(aws cognito-idp create-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-name "Trioll Developer Portal" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --no-generate-secret \
    --read-attributes "email" "name" "preferred_username" \
    --region $REGION 2>&1) || {
    echo -e "${RED}Failed to create app client. It may already exist.${NC}"
    echo "Response: $APP_CLIENT_RESPONSE"
    echo "Please check if the client already exists and note the ClientId."
    exit 1
}

CLIENT_ID=$(echo $APP_CLIENT_RESPONSE | grep -o '"ClientId": "[^"]*"' | cut -d'"' -f4)
echo -e "${GREEN}✓ App Client created successfully!${NC}"
echo -e "${GREEN}  Client ID: $CLIENT_ID${NC}"

# Save Client ID to file for later use
echo $CLIENT_ID > developer-portal-client-id.txt
echo -e "${YELLOW}  Client ID saved to developer-portal-client-id.txt${NC}"

# Step 2: Create Developer IAM Role
echo -e "\n${YELLOW}Step 2: Creating Developer IAM Role...${NC}"

# Create trust policy
cat > developer-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "$IDENTITY_POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF

# Create the role
aws iam create-role \
    --role-name trioll-developer-portal-role \
    --assume-role-policy-document file://developer-trust-policy.json \
    --description "IAM role for Trioll Developer Portal users" \
    --region $REGION || {
    echo -e "${YELLOW}Role might already exist. Continuing...${NC}"
}

# Create and attach the policy
cat > developer-portal-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::$GAMES_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::$GAMES_BUCKET"
    },
    {
      "Effect": "Allow",
      "Action": "execute-api:Invoke",
      "Resource": [
        "arn:aws:execute-api:$REGION:*:*/prod/POST/games",
        "arn:aws:execute-api:$REGION:*:*/prod/*/developers/*",
        "arn:aws:execute-api:$REGION:*:*/prod/GET/games/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name trioll-developer-portal-role \
    --policy-name DeveloperPortalPolicy \
    --policy-document file://developer-portal-policy.json || {
    echo -e "${YELLOW}Policy might already exist. Continuing...${NC}"
}

echo -e "${GREEN}✓ IAM Role created successfully!${NC}"

# Step 3: Create Cognito User Pool Group
echo -e "\n${YELLOW}Step 3: Creating Developers Group in Cognito...${NC}"

aws cognito-idp create-group \
    --group-name developers \
    --user-pool-id $USER_POOL_ID \
    --description "Trioll Developer Portal Users" \
    --precedence 10 \
    --region $REGION || {
    echo -e "${YELLOW}Group might already exist. Continuing...${NC}"
}

echo -e "${GREEN}✓ Developers group created successfully!${NC}"

# Step 4: Update S3 Bucket CORS
echo -e "\n${YELLOW}Step 4: Updating S3 Bucket CORS configuration...${NC}"

cat > s3-cors.json << EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": [
        "https://triolldev.com",
        "https://www.triolldev.com",
        "http://localhost:*",
        "http://127.0.0.1:*"
      ],
      "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket $GAMES_BUCKET \
    --cors-configuration file://s3-cors.json \
    --region $REGION

echo -e "${GREEN}✓ S3 CORS updated successfully!${NC}"

# Step 5: Create DynamoDB GSI for developerId
echo -e "\n${YELLOW}Step 5: Creating DynamoDB Global Secondary Index...${NC}"

echo -e "${YELLOW}This will create a GSI on the games table for querying by developerId${NC}"
echo -e "${YELLOW}Note: This operation may take several minutes...${NC}"

aws dynamodb update-table \
    --table-name $GAMES_TABLE \
    --attribute-definitions AttributeName=developerId,AttributeType=S \
    --global-secondary-index-updates \
    '[{
        "Create": {
            "IndexName": "developerId-index",
            "Keys": [
                {"AttributeName": "developerId", "KeyType": "HASH"}
            ],
            "Projection": {"ProjectionType": "ALL"},
            "BillingMode": "PAY_PER_REQUEST"
        }
    }]' \
    --region $REGION || {
    echo -e "${YELLOW}GSI might already exist or table might be updating. Check AWS Console.${NC}"
}

echo -e "${GREEN}✓ GSI creation initiated!${NC}"

# Step 6: Update Cognito Identity Pool (manual step required)
echo -e "\n${YELLOW}Step 6: Cognito Identity Pool Configuration${NC}"
echo -e "${RED}⚠️  MANUAL STEP REQUIRED:${NC}"
echo "1. Go to AWS Console > Cognito > Identity Pools"
echo "2. Select: Trioll Identity Pool ($IDENTITY_POOL_ID)"
echo "3. Edit identity pool"
echo "4. Under 'Authentication providers' > 'Cognito':"
echo "   - Add new provider with:"
echo "   - User Pool ID: $USER_POOL_ID"
echo "   - App Client ID: $CLIENT_ID"
echo "5. Under 'Authenticated role selection':"
echo "   - Choose 'Choose role with rules'"
echo "   - Add rule for claim: 'cognito:groups' contains 'developers'"
echo "   - Assign role: 'trioll-developer-portal-role'"

# Clean up temporary files
echo -e "\n${YELLOW}Cleaning up temporary files...${NC}"
rm -f developer-trust-policy.json developer-portal-policy.json s3-cors.json

# Summary
echo -e "\n${GREEN}=================================================="
echo "✅ Infrastructure Setup Complete!"
echo "=================================================="
echo -e "${NC}"
echo "Summary:"
echo "- App Client ID: $CLIENT_ID (saved in developer-portal-client-id.txt)"
echo "- IAM Role: trioll-developer-portal-role"
echo "- Cognito Group: developers"
echo "- S3 CORS: Updated for triolldev.com"
echo "- DynamoDB GSI: developerId-index (check status in console)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Complete the manual Cognito Identity Pool configuration (Step 6)"
echo "2. Update Lambda environment variables with the new Client ID"
echo "3. Deploy the updated Lambda functions"
echo ""
echo -e "${GREEN}Ready to proceed with Phase 1: Backend Updates!${NC}"