# Multi-Client Lambda Implementation Guide

## Overview
This solution allows a single Lambda function to support both the mobile app and developer portal by accepting different Cognito client IDs based on the request source.

## How It Works

### 1. Client Identification
The Lambda looks for an `X-App-Client` header to determine which client is making the request:
- `X-App-Client: developer-portal` → Uses developer portal client ID
- No header or any other value → Uses mobile app client ID (default)

### 2. Client IDs
- **Mobile App**: `bft50gui77sdq2n4lcio4onql` (default)
- **Developer Portal**: `5joogquqr4jgukp7mncgp3g23h`

### 3. User Type Differentiation
Based on the client ID used during login, the Lambda creates different user types:
- Developer portal → `userType: 'developer'` with `developerId`
- Mobile app → `userType: 'consumer'` with `username`

## Implementation Steps

### Step 1: Deploy the Lambda
1. Copy `unified-developers-api-multiclient.js` to your Lambda deployment
2. Update environment variables:
   ```bash
   DEVELOPER_CLIENT_ID=5joogquqr4jgukp7mncgp3g23h
   CLIENT_ID=bft50gui77sdq2n4lcio4onql
   ```

### Step 2: Update Frontend Code
Ensure auth-service.js sends the header:

```javascript
// In auth-service.js - already implemented
headers: {
    'Content-Type': 'application/json',
    'X-App-Client': 'developer-portal'  // This identifies developer portal requests
}
```

### Step 3: Test the Implementation

#### Test Developer Portal Login:
```bash
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/login \
  -H "Content-Type: application/json" \
  -H "X-App-Client: developer-portal" \
  -d '{
    "email": "developer@example.com",
    "password": "password123"
  }'
```

Expected response includes `developer` object with `developerId`.

#### Test Mobile App Login:
```bash
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Expected response includes `user` object without `developerId`.

## Benefits

1. **Single Lambda**: Easier to maintain and deploy
2. **Cost Effective**: One Lambda function instead of two
3. **Flexible**: Easy to add more client IDs in the future
4. **Clean Separation**: Developer accounts are distinct from app users

## Migration Path

1. Deploy the multi-client Lambda
2. Test with both portal and mobile app
3. Monitor CloudWatch logs to ensure correct client ID usage
4. Remove old Lambda if everything works correctly

## Troubleshooting

### Authentication Fails
- Check CloudWatch logs for which client ID was used
- Verify `X-App-Client` header is being sent
- Ensure environment variables are set correctly

### Wrong User Type Created
- Check the `X-App-Client` header value
- Verify the client ID mapping in `getClientId()` function

### Token Issues
- Tokens are specific to client IDs
- Cannot use mobile app tokens in developer portal or vice versa
- Each client maintains its own session

## Security Considerations

1. **Client IDs are not secrets** - They're public identifiers
2. **Tokens are client-specific** - Cannot cross-authenticate
3. **User types prevent cross-access** - Developers can't access consumer features

## Future Enhancements

1. Add more client types (admin portal, partner portal, etc.)
2. Implement role-based access control
3. Add client-specific feature flags
4. Create separate DynamoDB indexes for different user types