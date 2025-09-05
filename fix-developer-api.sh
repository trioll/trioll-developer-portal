#!/bin/bash

echo "🔍 Checking API Gateway and Lambda configuration..."

# Check if developer endpoints exist in API Gateway
echo "1. Checking API Gateway routes..."
aws apigateway get-resources --rest-api-id 4ib0hvu1xj --region us-east-1 | grep -E "(developers|register|login)" || echo "❌ No developer routes found"

# Check Lambda function
echo -e "\n2. Checking Lambda function..."
aws lambda get-function --function-name trioll-prod-users-api --region us-east-1 --query 'Configuration.LastModified' --output text

# Check CORS configuration
echo -e "\n3. Checking CORS configuration..."
aws apigateway get-integration-response --rest-api-id 4ib0hvu1xj --resource-id $(aws apigateway get-resources --rest-api-id 4ib0hvu1xj --region us-east-1 --query 'items[?path==`/developers/register`].id' --output text) --http-method POST --status-code 200 --region us-east-1 2>/dev/null || echo "Developer endpoints may not be configured"

echo -e "\n📝 To fix the issue, you need to:"
echo "1. Deploy the updated Lambda function with developer endpoints"
echo "2. Create the API Gateway routes for /developers/*"
echo "3. Configure CORS for the developer portal"

echo -e "\n🚀 Run the following commands to deploy:"
echo ""
echo "# Deploy the Lambda function"
echo "cd backend-updates"
echo "cp users-api-with-developers.js index.js"
echo "zip -r users-api-deployment.zip index.js"
echo "aws lambda update-function-code --function-name trioll-prod-users-api --zip-file fileb://users-api-deployment.zip --region us-east-1"
echo ""
echo "# After Lambda deployment, you'll need to:"
echo "1. Go to API Gateway console"
echo "2. Add routes for:"
echo "   - POST /developers/register"
echo "   - POST /developers/login"
echo "   - GET /developers/profile"
echo "   - GET /developers/games"
echo "3. Configure CORS to allow triolldev.com (or your current domain)"
echo "4. Deploy the API"