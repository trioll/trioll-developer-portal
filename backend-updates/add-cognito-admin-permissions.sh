#!/bin/bash

# Add missing Cognito admin permissions to Lambda execution role

POLICY_ARN="arn:aws:iam::561645284740:policy/TriollLambdaServicesAccess"
REGION="us-east-1"

echo "🔐 Adding Cognito admin permissions to Lambda role..."
echo ""

# Create updated policy document
cat > cognito-admin-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DynamoDBAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:561645284740:table/trioll-prod-*",
                "arn:aws:dynamodb:us-east-1:561645284740:table/trioll-prod-*/index/*"
            ]
        },
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::trioll-prod-*/*",
                "arn:aws:s3:::trioll-prod-*"
            ]
        },
        {
            "Sid": "CloudFrontAccess",
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetDistribution",
                "cloudfront:CreateSignedUrl"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CognitoAccess",
            "Effect": "Allow",
            "Action": [
                "cognito-idp:AdminGetUser",
                "cognito-idp:AdminUpdateUserAttributes",
                "cognito-idp:AdminConfirmSignUp",
                "cognito-idp:AdminSetUserPassword",
                "cognito-idp:AdminInitiateAuth",
                "cognito-identity:GetCredentialsForIdentity"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SQSAccess",
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage"
            ],
            "Resource": "arn:aws:sqs:us-east-1:561645284740:trioll-*"
        },
        {
            "Sid": "ComprehendAccess",
            "Effect": "Allow",
            "Action": [
                "comprehend:DetectSentiment",
                "comprehend:DetectKeyPhrases"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create new policy version
echo "📝 Creating new policy version..."
aws iam create-policy-version \
    --policy-arn $POLICY_ARN \
    --policy-document file://cognito-admin-policy.json \
    --set-as-default

if [ $? -eq 0 ]; then
    echo "✅ Successfully added Cognito admin permissions!"
    echo ""
    echo "Added permissions:"
    echo "- cognito-idp:AdminConfirmSignUp (for auto-confirmation)"
    echo "- cognito-idp:AdminSetUserPassword"
    echo "- cognito-idp:AdminInitiateAuth"
    echo ""
    echo "Auto-confirmation should now work for new registrations."
else
    echo "❌ Failed to update policy"
    exit 1
fi

# Clean up
rm cognito-admin-policy.json

# List policy versions
echo ""
echo "📋 Current policy versions:"
aws iam list-policy-versions --policy-arn $POLICY_ARN --query 'Versions[?IsDefaultVersion==`true`]' --output json