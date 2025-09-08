#!/bin/bash

# Fix Lambda permissions for game update API

echo "Updating DynamoDB permissions for trioll-games-update-lambda-role..."

aws iam put-role-policy \
  --role-name trioll-games-update-lambda-role \
  --policy-name DynamoDBAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:Query"
            ],
            "Resource": "arn:aws:dynamodb:us-east-1:*:table/trioll-prod-games"
        }
    ]
}'

echo "✅ Permissions updated successfully!"
echo ""
echo "The Lambda function now has permission to:"
echo "- Query games (to find the version)"
echo "- Get specific game items"
echo "- Update game items"