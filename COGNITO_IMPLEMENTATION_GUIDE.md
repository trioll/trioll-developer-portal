# Cognito Custom Claims Implementation Guide

## Quick Start (For Immediate Fix)

If you want to implement this solution right away, follow these steps in order:

### 1. Deploy the Pre-Token Lambda
```bash
cd backend-updates
./deploy-pre-token-lambda.sh
```

### 2. Configure Cognito Trigger
```bash
./configure-cognito-trigger.sh
```

### 3. Migrate Your User (One-time)
```bash
node migrate-user-attributes.js --user freddiecaplin@hotmail.com
```

### 4. Test
- Log out of the developer portal
- Log back in
- Open `debug-token-claims.html` in your browser
- You should now see `custom:developer_id` in your token!

## What This Solution Does

### Before (Current Problem):
```
Login → Cognito Token (missing developer_id) → API Call → 401 Error
```

### After (With Solution):
```
Login → Pre-Token Lambda → Token (includes developer_id) → API Call → Success!
```

## Detailed Implementation Steps

### Step 1: Deploy Pre-Token Generation Lambda

This Lambda runs every time Cognito generates a token:
- Looks up the user's developer_id from DynamoDB
- Adds it to the token as `custom:developer_id`
- Caches it in Cognito for future logins

```bash
./deploy-pre-token-lambda.sh
```

Expected output:
```
🚀 Deploying Cognito Pre-Token Generation Lambda...
📦 Creating deployment package...
🆕 Creating new function...
✅ Lambda function deployed
✅ Permissions configured
🎉 Pre-Token Generation Lambda deployed successfully!
```

### Step 2: Configure Cognito to Use the Lambda

This connects your Lambda to Cognito:

```bash
./configure-cognito-trigger.sh
```

Expected output:
```
🔧 Configuring Cognito Pre-Token Generation Trigger...
✅ Cognito trigger configured successfully!
✅ Pre-Token Generation trigger is active
```

### Step 3: Migrate Existing Users

For users who already exist (like you), run the migration:

```bash
# Migrate all users
node migrate-user-attributes.js

# Or migrate just your user
node migrate-user-attributes.js --user freddiecaplin@hotmail.com
```

Expected output:
```
Processing: freddiecaplin@hotmail.com
  Developer ID: dev_c84a7e
  Company: FreddieTrioll
  ✅ Successfully updated Cognito attributes
```

### Step 4: Test the Solution

1. **Log out** of the developer portal
2. **Log back in**
3. Open `debug-token-claims.html`
4. Look for these in your token:
   ```json
   {
     "custom:developer_id": "dev_c84a7e",
     "custom:user_type": "developer",
     "custom:company_name": "FreddieTrioll"
   }
   ```

## How It Works

### First Login After Implementation:
1. User logs in
2. Cognito starts generating token
3. Pre-Token Lambda triggers
4. Lambda queries DynamoDB for developer_id
5. Lambda adds developer_id to token
6. Lambda saves developer_id to Cognito (for next time)
7. User gets token with all custom claims

### Subsequent Logins (Faster):
1. User logs in
2. Cognito already has developer_id
3. Pre-Token Lambda adds it to token
4. No database lookup needed!

## Verification

After implementation, your token will look like this:

```json
{
  "sub": "your-user-id",
  "email": "freddiecaplin@hotmail.com",
  "custom:developer_id": "dev_c84a7e",
  "custom:user_type": "developer",
  "custom:company_name": "FreddieTrioll",
  "aud": "5joogquqr4jgukp7mncgp3g23h",
  // ... other standard claims
}
```

## Benefits

1. **No More 401 Errors**: API recognizes you as a developer
2. **Better Performance**: No database lookups on every API call
3. **Works Everywhere**: Mobile app, web platform, developer portal
4. **Future Proof**: New developers automatically get claims

## Troubleshooting

### Token still doesn't have custom claims?
1. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/trioll-prod-pre-token-generation --follow
   ```

2. Verify trigger is configured:
   ```bash
   aws cognito-idp describe-user-pool --user-pool-id us-east-1_cLPH2acQd \
     --query 'UserPool.LambdaConfig.PreTokenGeneration'
   ```

### Getting errors?
- Make sure you're logged in with AWS CLI
- Verify the Lambda deployed successfully
- Check that your user exists in DynamoDB

### Need to rollback?
```bash
# Remove the trigger
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_cLPH2acQd \
  --lambda-config '{}' \
  --region us-east-1
```

## Next Steps

Once this is working:
1. All new developer registrations will automatically get custom claims
2. The games API will work without any fallback logic
3. You can simplify the Lambda code to remove database lookups

This is the production-ready solution that scales to millions of users!