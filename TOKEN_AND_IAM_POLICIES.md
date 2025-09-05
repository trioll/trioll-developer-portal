# Token and IAM Policies Review

## Current Token Configuration

### 1. Cognito Token Settings
- **Refresh Token Validity**: 30 days ✅
- **Access Token Validity**: Not set (defaults to 1 hour)
- **ID Token Validity**: Not set (defaults to 1 hour)
- **Token Validity Units**: Not configured (defaults to hours)

### 2. Issues Found

#### ❌ Missing Cognito Admin Permissions
The Lambda execution role is missing a critical permission:
```
cognito-idp:AdminConfirmSignUp
```

This is why auto-confirmation might fail for some users.

#### ❌ No Token Refresh Configuration
The client doesn't have explicit token validity settings, relying on defaults.

#### ⚠️ S3 Upload Permissions
While Lambda has S3 access, the frontend uploads directly to S3. Need to verify:
1. CORS configuration on S3 bucket
2. Cognito Identity Pool permissions for authenticated users

## Required Policy Updates

### 1. Update Lambda Execution Role
Add to `TriollLambdaServicesAccess` policy:
```json
{
    "Sid": "CognitoAdminAccess",
    "Effect": "Allow",
    "Action": [
        "cognito-idp:AdminConfirmSignUp",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminInitiateAuth"
    ],
    "Resource": "arn:aws:cognito-idp:us-east-1:561645284740:userpool/us-east-1_cLPH2acQd"
}
```

### 2. Configure Token Validity
Update Cognito client settings:
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_cLPH2acQd \
  --client-id 5joogquqr4jgukp7mncgp3g23h \
  --access-token-validity 2 \
  --id-token-validity 2 \
  --token-validity-units AccessToken=hours,IdToken=hours,RefreshToken=days \
  --region us-east-1
```

This would extend tokens to 2 hours for better developer experience.

### 3. Check S3 Bucket CORS
The S3 bucket needs proper CORS for frontend uploads:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "POST", "DELETE", "GET"],
        "AllowedOrigins": [
            "https://triolldev.com",
            "https://www.triolldev.com",
            "http://localhost:*"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

### 4. Cognito Identity Pool Authenticated Role
Check if authenticated users have S3 upload permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::trioll-prod-games-us-east-1/*"
        }
    ]
}
```

## Immediate Actions

1. **For Token Expiry**: Extend token validity to 2-4 hours for developer portal
2. **For S3 Uploads**: Verify CORS and IAM permissions
3. **For Auto-confirm**: Add missing Cognito admin permission

## Security Best Practices

Current setup is good, but consider:
1. Implement token refresh in frontend (use refresh token before ID token expires)
2. Add CloudWatch alarms for failed authentications
3. Enable AWS CloudTrail for Cognito events
4. Consider MFA for developer accounts in future