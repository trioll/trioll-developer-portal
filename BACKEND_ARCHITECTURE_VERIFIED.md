# Backend Architecture - Verified September 5, 2025

## Overview
This document contains the verified backend architecture after comprehensive investigation.

## AWS Resources

### API Gateway
- **API ID**: 4ib0hvu1xj
- **API Name**: trioll-prod-api
- **Base URL**: https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod

### Lambda Function
- **Function Name**: trioll-prod-users-api
- **Runtime**: Node.js 18.x
- **Handler**: index.handler
- **Code Size**: 14.6 MB
- **Timeout**: 30 seconds
- **Memory**: 256 MB

### Environment Variables
```json
{
  "ALLOWED_ORIGINS": "https://triolldev.com,https://www.triolldev.com,http://localhost:5500",
  "DEVELOPER_CLIENT_ID": "5joogquqr4jgukp7mncgp3g23h",
  "CLIENT_ID": "bft50gui77sdq2n4lcio4onql",
  "JWT_SECRET": "trioll-jwt-secret-2024",
  "DEVELOPER_APP_CLIENT_ID": "5joogquqr4jgukp7mncgp3g23h",
  "USERS_TABLE": "trioll-prod-users",
  "GAMES_TABLE": "trioll-prod-games",
  "USER_POOL_ID": "us-east-1_cLPH2acQd"
}
```

### API Routes (Developer Portal)
- `POST /developers/login` → trioll-prod-users-api
- `POST /developers/register` → trioll-prod-users-api
- `GET /developers/profile` → trioll-prod-users-api
- `GET /developers/games` → trioll-prod-users-api

### Cognito Configuration
- **User Pool**: us-east-1_cLPH2acQd
- **Developer Portal Client**: 5joogquqr4jgukp7mncgp3g23h ("Trioll Developer Portal")
- **Mobile App Client**: bft50gui77sdq2n4lcio4onql
- **Auth Flows**: ALLOW_REFRESH_TOKEN_AUTH, ALLOW_USER_PASSWORD_AUTH

### IAM Role
- **Role Name**: trioll-lambda-execution-role
- **Attached Policies**:
  - TriollLambdaServicesAccess
  - AWSLambdaVPCAccessExecutionRole
  - AWSLambdaBasicExecutionRole
  - AWSXRayDaemonWriteAccess
- **Inline Policies**:
  - DynamoDBAccess
  - TriollDynamoDBPolicy
  - CognitoAdminPermissions (added Sept 5)

### Multi-Client Support
The Lambda now supports both mobile app and developer portal:
- Detects client via `X-App-Client` header
- `X-App-Client: developer-portal` → Uses developer portal client ID
- No header → Uses mobile app client ID (default)

## Test Results

### Direct API Test (Working)
```bash
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/login \
  -H "Content-Type: application/json" \
  -H "X-App-Client: developer-portal" \
  -d '{"email": "freddiecaplin@hotmail.com", "password": "@Freddie1"}'
```

Response includes:
- `tokens.idToken`: Valid JWT token
- `tokens.accessToken`: Valid access token
- `tokens.refreshToken`: Valid refresh token
- `developer`: Developer profile with developerId

### CloudWatch Logs
Confirms correct client ID detection:
```
Using developer portal client ID: 5joogquqr4jgukp7mncgp3g23h
```

## Frontend Issue (To Be Fixed)
The backend is returning correct responses, but frontend is not storing tokens.
This needs to be debugged in the browser console to identify JavaScript errors.