#!/bin/bash

echo "🔧 Adding Cognito AdminConfirmSignUp permission to Lambda role..."

# Get the policy ARN
POLICY_ARN=$(aws iam list-attached-role-policies --role-name trioll-lambda-execution-role --query "AttachedPolicies[?PolicyName=='TriollLambdaServicesAccess'].PolicyArn" --output text)

if [ -z "$POLICY_ARN" ]; then
    echo "❌ TriollLambdaServicesAccess policy not found"
    exit 1
fi

echo "Found policy: $POLICY_ARN"

# Get current policy document
CURRENT_VERSION=$(aws iam get-policy --policy-arn $POLICY_ARN --query 'Policy.DefaultVersionId' --output text)
aws iam get-policy-version --policy-arn $POLICY_ARN --version-id $CURRENT_VERSION --query 'PolicyVersion.Document' > current-policy.json

# Add AdminConfirmSignUp to Cognito permissions
cat current-policy.json | jq '.Statement |= map(
    if (.Effect == "Allow" and (.Action | type == "array") and any(.Action[]; contains("cognito-idp")))
    then .Action += ["cognito-idp:AdminConfirmSignUp", "cognito-idp:AdminAddUserToGroup"]
    else .
    end
)' > updated-policy.json

echo "Updated policy:"
cat updated-policy.json | jq

# Create new policy version
echo "Creating new policy version..."
aws iam create-policy-version \
    --policy-arn $POLICY_ARN \
    --policy-document file://updated-policy.json \
    --set-as-default

echo "✅ Permissions added successfully!"
echo ""
echo "The Lambda function now has permission to:"
echo "- AdminConfirmSignUp (auto-confirm users)"
echo "- AdminAddUserToGroup (add users to developer group)"

# Clean up
rm current-policy.json updated-policy.json