# Developer Token System Analysis

## Overview
The developer token system is causing authentication failures across multiple endpoints. This document provides a comprehensive analysis of how the token system is currently set up and its dependencies.

## Current Token Architecture

### 1. **Token Source: AWS Cognito**
- **User Pool**: `us-east-1_cLPH2acQd`
- **Client ID**: `5joogquqr4jgukp7mncgp3g23h` (Developer Portal)
- **Token Type**: JWT (JSON Web Tokens)
- **Components**:
  - ID Token (used as primary auth token)
  - Access Token
  - Refresh Token

### 2. **Critical Discovery: Missing Custom Attributes**
**The Cognito User Pool does NOT have custom attributes for:**
- `custom:developer_id`
- `custom:company_name`
- `custom:user_type`

These attributes are expected by the Lambda functions but are NOT configured in Cognito.

### 3. **Token Flow**

#### Frontend (index.html):
1. User logs in via `/developers/login` endpoint
2. Backend returns JWT tokens from Cognito
3. Frontend stores token in:
   - `localStorage` (if "Remember Me" is checked)
   - `sessionStorage` (default)
4. Token is sent with requests as: `Authorization: Bearer {token}`

#### Backend (Lambda Functions):
1. Extract token from Authorization header
2. Decode JWT to get user info
3. **PROBLEM**: Look for `custom:developer_id` in token (doesn't exist)
4. Fall back to database lookup using `sub` (user ID)

### 4. **Token Payload Structure**
Standard Cognito JWT contains:
```json
{
  "sub": "uuid",           // User ID
  "email": "user@example.com",
  "cognito:username": "user@example.com",
  "email_verified": true,
  // NO custom attributes!
}
```

### 5. **Backend Services Using Tokens**

#### A. **trioll-prod-users-api** (Lambda)
- **Handler**: `index.handler`
- **Endpoints**: `/developers/*`, `/users/*`
- **Issue**: Expects custom attributes in JWT that don't exist
- **Workaround**: Falls back to DynamoDB lookup

#### B. **trioll-prod-games-api** (Lambda)
- **Handler**: `games-api-fixed.handler`
- **Endpoints**: `/games/*`, `/developers/games`
- **Issue**: Checks for `developerId` in token payload
- **Result**: Returns "hasDeveloperId: false"

#### C. **trioll-prod-games-update-api** (Lambda)
- **Handler**: `games-update-api.handler`
- **Endpoints**: PUT `/games/{gameId}`
- **Issue**: Same token decoding problem

### 6. **Data Storage**

#### DynamoDB Tables:
1. **trioll-prod-users**
   - Primary Key: `userId` (from Cognito `sub`)
   - Contains: `developerId`, `companyName`, `userType`
   - GSI: `developerIdIndex` for lookups

2. **trioll-prod-games**
   - Primary Key: `id` (not `gameId`!)
   - Contains: `developerId` for ownership
   - GSI: `developerId-index` for developer's games

### 7. **Authentication Flow Issues**

1. **Login Process**:
   ```
   Frontend → /developers/login → Lambda → Cognito → JWT (no custom attrs)
   ```

2. **API Requests**:
   ```
   Frontend → API Gateway → Lambda → Decode JWT → Missing developerId → FAIL
   ```

3. **Fallback Attempt**:
   ```
   Lambda → DynamoDB lookup by userId → Sometimes works, often fails
   ```

### 8. **Why It's Failing**

1. **Cognito Configuration**: No custom attributes configured
2. **Lambda Expectations**: Code expects attributes that don't exist
3. **Inconsistent Fallbacks**: Some Lambdas handle missing data, others don't
4. **Special Case Hardcoding**: Only `freddiecaplin@hotmail.com` has hardcoded fallback

### 9. **Developer ID Generation**
- Generated during signup/first login
- Stored in DynamoDB, NOT in Cognito
- Format: `dev_[first6]` with increments for duplicates
- Example: `dev_freddi`, `dev_freddi1`, `dev_freddi2`

### 10. **Frontend Token Management**
- **auth-service.js**: Manages token lifecycle
- **getDeveloperId()**: Attempts to extract from token (fails)
- **Fallback**: Returns hardcoded `dev_c84a7e`

## Summary of Issues

1. **Root Cause**: Cognito tokens don't contain developer-specific attributes
2. **Impact**: All developer-authenticated endpoints fail
3. **Workarounds**: Inconsistent and unreliable
4. **Fix Required**: Either:
   - Add custom attributes to Cognito (complex, requires migration)
   - Update all Lambdas to reliably fetch from DynamoDB (recommended)

## Recommended Solution

Update all Lambda functions to:
1. Decode JWT to get `sub` (user ID)
2. Always fetch developer info from DynamoDB using `sub`
3. Cache the lookup result in the Lambda context
4. Never rely on custom attributes in the JWT

This approach is more reliable and doesn't require Cognito schema changes.