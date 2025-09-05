#!/bin/bash

# Fix IAM permissions for S3 uploads
# The issue: trioll-staging-auth-role is trying to access trioll-prod-games-us-east-1

echo "🔍 Current situation:"
echo "- Identity Pool: us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268"
echo "- Auth Role: trioll-staging-auth-role (WRONG - this is staging!)"
echo "- S3 Bucket: trioll-prod-games-us-east-1 (production)"
echo ""
echo "❌ Problem: Staging role can't write to production bucket"
echo ""
echo "✅ Solution: Update the Identity Pool to use production roles"
echo ""
echo "Steps to fix:"
echo "1. Go to AWS Cognito Console > Identity Pools"
echo "2. Select identity pool: us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268"
echo "3. Click 'Edit identity pool'"
echo "4. Under 'Authenticated role', change from:"
echo "   - trioll-staging-auth-role"
echo "   to:"
echo "   - trioll-auth-role (or trioll-prod-auth-role)"
echo "5. Save changes"
echo ""
echo "Alternative: Add S3 permissions to staging role"
echo "1. Go to IAM > Roles > trioll-staging-auth-role"
echo "2. Add inline policy:"
cat << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1/*"
        }
    ]
}
EOF