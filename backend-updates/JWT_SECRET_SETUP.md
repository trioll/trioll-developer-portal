# JWT Secret Setup Guide

## Overview
The JWT_SECRET is now required as an environment variable for security. 
This prevents secrets from being hardcoded in the source code.

## Setting Up JWT_SECRET in AWS Lambda

### Option 1: Using AWS Console (Recommended)
1. Go to AWS Lambda Console
2. Find your Lambda function (e.g., `trioll-prod-games-update-api`)
3. Go to "Configuration" tab → "Environment variables"
4. Click "Edit" and add:
   - Key: `JWT_SECRET`
   - Value: `[your-secure-secret]`
5. Save changes

### Option 2: Using AWS CLI
```bash
aws lambda update-function-configuration \
  --function-name trioll-prod-games-update-api \
  --environment Variables="{JWT_SECRET='your-secure-secret-here'}" \
  --region us-east-1
```

### Option 3: Using AWS Secrets Manager (Most Secure)
1. Create secret in Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name trioll/prod/jwt-secret \
  --secret-string "your-secure-secret-here" \
  --region us-east-1
```

2. Update Lambda to read from Secrets Manager:
```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

async function getJwtSecret() {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: "trioll/prod/jwt-secret" })
  );
  return response.SecretString;
}
```

## Important Notes

1. **Never commit actual secrets to Git**
2. **Use a strong, random secret** (at least 32 characters)
3. **Different secrets for different environments** (dev/staging/prod)
4. **Rotate secrets periodically**

## Generate a Secure Secret
```bash
# Generate a 64-character random secret
openssl rand -base64 48
```

## Current Status
- The code now requires JWT_SECRET as environment variable
- If not set, the Lambda will fail to start with clear error message
- This is more secure than hardcoding secrets

## Note on This Specific Lambda
In `games-update-api-fixed.js`, the JWT_SECRET is defined but not actually used because:
- API Gateway handles JWT validation
- The Lambda decodes tokens without verification
- This is correct for this use case

However, keeping the environment variable requirement ensures:
- Consistency across all Lambda functions
- Ready for future use if needed
- Clear security practices