# Identity Pool Configuration Analysis

## Current Error
```
Invalid identity pool configuration. Check assigned IAM roles for this pool.
Error code: InvalidIdentityPoolConfigurationException
```

## What This Means
The `trioll-prod-auth-role` doesn't have the correct trust relationship policy to be assumed by Cognito Identity Pool.

## Evidence from Logs
1. **Authenticated access fails**: InvalidIdentityPoolConfigurationException
2. **Falls back to guest role**: Uses `trioll-staging-guest-role` 
3. **Guest upload works**: But can't delete (no DeleteObject permission)

## The Problem Chain

### 1. Identity Pool Configuration
- Pool: `us-east-1:c740f334-5bd2-43c6-85b9-48bfebf27268`
- Authenticated Role: `trioll-prod-auth-role` ❌ (missing trust relationship)
- Unauthenticated Role: `trioll-staging-guest-role` ✅ (works but is staging)

### 2. Mixed Environment Issue
You now have:
- **Guest Role**: `trioll-staging-guest-role` (staging)
- **Auth Role**: `trioll-prod-auth-role` (production)
- **S3 Bucket**: `trioll-prod-games-us-east-1` (production)

### 3. Trust Relationship Issue
The `trioll-prod-auth-role` needs a trust relationship policy like:
```json
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
```

## Why Mobile App Might Be Affected

The mobile app likely:
1. Uses the same Identity Pool
2. Was relying on `trioll-staging-auth-role` permissions
3. May have staging-specific API endpoints or S3 buckets hardcoded

## Immediate Solutions

### Option 1: Revert to Staging Role (Quick Fix)
1. Go back to Cognito Console
2. Change authenticated role back to `trioll-staging-auth-role`
3. Everything will work as before

### Option 2: Fix the Production Role
1. Go to IAM > Roles > `trioll-prod-auth-role`
2. Click "Trust relationships" tab
3. Edit trust policy to include the Identity Pool ID
4. Save changes

### Option 3: Update Guest Role
1. Change unauthenticated role to `trioll-prod-guest-role` (if it exists)
2. Or add production S3 permissions to `trioll-staging-guest-role`

## Backend Dependencies Affected

### 1. S3 Bucket Access
- Staging roles → Production bucket = Permission mismatch
- Need consistent environment (all staging or all production)

### 2. API Gateway
- May have resource policies expecting staging roles
- Check if APIs validate role ARNs

### 3. Lambda Functions
- May check for specific role names
- Could have hardcoded staging role ARNs

### 4. DynamoDB
- Fine-grained access control might reference staging roles

## Recommended Action

**REVERT IMMEDIATELY** to `trioll-staging-auth-role` until you can:
1. Create proper production roles with correct trust policies
2. Update all backend services to accept production roles
3. Test thoroughly with both portal and mobile app

## The Real Issue

You're trying to use a production role that:
1. Wasn't set up for this Identity Pool
2. Doesn't have the right trust relationship
3. Is mixing with staging components (guest role)

This is why it's failing!