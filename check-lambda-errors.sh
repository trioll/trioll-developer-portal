#!/bin/bash

# Check CloudWatch logs for Lambda errors

echo "🔍 Checking Lambda function errors..."
echo "===================================="
echo ""

# Get recent logs for games API
echo "📋 Recent errors from trioll-prod-games-api:"
aws logs tail /aws/lambda/trioll-prod-games-api --region us-east-1 --since 10m --filter-pattern "ERROR" | head -20

echo ""
echo "📋 Recent logs (last 5 entries):"
aws logs tail /aws/lambda/trioll-prod-games-api --region us-east-1 --since 10m | tail -20