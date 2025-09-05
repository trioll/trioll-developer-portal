# AWS Setup Commands for Developer Portal

Quick reference for all AWS CLI commands needed to set up the developer portal infrastructure.

## 1. Create Cognito App Client for Developer Portal

```bash
aws cognito-idp create-user-pool-client \
    --user-pool-id us-east-1_cLPH2acQd \
    --client-name "Trioll Developer Portal" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --generate-secret false \
    --read-attributes "email" "name" "preferred_username" "custom:developer_id" "custom:company_name" "custom:user_type" \
    --write-attributes "email" "name" "preferred_username" "custom:developer_id" "custom:company_name" "custom:user_type" \
    --region us-east-1

# Save the ClientId from the response!
```

## 2. Create Developer IAM Role

First, create the trust policy file:
```bash
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
          "cognito-identity.amazonaws.com:aud": "us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF
```

Create the role:
```bash
aws iam create-role \
    --role-name trioll-developer-portal-role \
    --assume-role-policy-document file://developer-trust-policy.json \
    --region us-east-1
```

## 3. Attach Policies to Developer Role

Create the policy:
```bash
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
      "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["${cognito-identity.amazonaws.com:sub}/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "execute-api:Invoke",
      "Resource": [
        "arn:aws:execute-api:us-east-1:*:*/prod/POST/games",
        "arn:aws:execute-api:us-east-1:*:*/prod/*/developers/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name trioll-developer-portal-role \
    --policy-name DeveloperPortalPolicy \
    --policy-document file://developer-portal-policy.json
```

## 4. Create Cognito User Pool Group

```bash
aws cognito-idp create-group \
    --group-name developers \
    --user-pool-id us-east-1_cLPH2acQd \
    --description "Trioll Developer Portal Users" \
    --precedence 10 \
    --region us-east-1
```

## 5. Add Custom Attributes (if not exists)

```bash
# Check existing attributes first
aws cognito-idp describe-user-pool \
    --user-pool-id us-east-1_cLPH2acQd \
    --region us-east-1 \
    --query 'UserPool.SchemaAttributes[?Name==`custom:developer_id`]'

# If not exists, you'll need to create a new user pool or use existing attributes
```

## 6. Update S3 Bucket CORS

```bash
cat > s3-cors.json << EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": [
        "https://triolldev.com",
        "https://www.triolldev.com",
        "http://localhost:*"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket trioll-prod-games-us-east-1 \
    --cors-configuration file://s3-cors.json \
    --region us-east-1
```

## 7. Create DynamoDB GSI for Developer Games

```bash
aws dynamodb update-table \
    --table-name trioll-prod-games \
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
    --region us-east-1

# Wait for index to be active
aws dynamodb describe-table \
    --table-name trioll-prod-games \
    --region us-east-1 \
    --query 'Table.GlobalSecondaryIndexes[?IndexName==`developerId-index`].IndexStatus'
```

## 8. Update Lambda Environment Variables

```bash
# For users-api
aws lambda update-function-configuration \
    --function-name trioll-prod-users-api \
    --environment Variables='{
        "DEVELOPER_APP_CLIENT_ID":"<NEW_CLIENT_ID_FROM_STEP_1>",
        "ALLOWED_ORIGINS":"https://triolldev.com,https://www.triolldev.com"
    }' \
    --region us-east-1

# For games-api  
aws lambda update-function-configuration \
    --function-name trioll-prod-get-games \
    --environment Variables='{
        "DEVELOPER_APP_CLIENT_ID":"<NEW_CLIENT_ID_FROM_STEP_1>",
        "ALLOWED_ORIGINS":"https://triolldev.com,https://www.triolldev.com"
    }' \
    --region us-east-1
```

## 9. Update Cognito Identity Pool

```bash
# Get current configuration
aws cognito-identity describe-identity-pool \
    --identity-pool-id us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268 \
    --region us-east-1 > identity-pool-config.json

# Edit the JSON to add developer role mapping
# Then update:
aws cognito-identity update-identity-pool \
    --identity-pool-id us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268 \
    --identity-pool-name "Trioll Identity Pool" \
    --allow-unauthenticated-identities \
    --cognito-identity-providers \
        ProviderName="cognito-idp.us-east-1.amazonaws.com/us-east-1_cLPH2acQd",ClientId="<NEW_CLIENT_ID_FROM_STEP_1>" \
    --region us-east-1
```

## 10. Test the Setup

```bash
# Test S3 CORS
curl -X OPTIONS https://trioll-prod-games-us-east-1.s3.amazonaws.com \
    -H "Origin: https://triolldev.com" \
    -H "Access-Control-Request-Method: PUT"

# Test API Gateway
curl https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games \
    -H "Origin: https://triolldev.com"
```

## Important Notes

1. Replace `<NEW_CLIENT_ID_FROM_STEP_1>` with the actual client ID from step 1
2. Keep the developer app client ID separate from mobile app client ID
3. Test each step before proceeding to the next
4. Monitor CloudWatch logs during testing
5. Back up current configurations before making changes

## Cleanup Commands (if needed)

```bash
# Delete app client
aws cognito-idp delete-user-pool-client \
    --user-pool-id us-east-1_cLPH2acQd \
    --client-id <CLIENT_ID> \
    --region us-east-1

# Delete IAM role
aws iam delete-role-policy \
    --role-name trioll-developer-portal-role \
    --policy-name DeveloperPortalPolicy

aws iam delete-role \
    --role-name trioll-developer-portal-role
```