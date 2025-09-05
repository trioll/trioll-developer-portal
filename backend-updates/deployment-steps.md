# Backend Deployment Steps for Developer ID System

## Overview
This update adds developer ID storage to the backend with automatic incremental ID generation for similar email addresses.

## Files Created
1. `developers-api-enhanced.js` - Enhanced Lambda function with developer ID generation
2. `create-developer-id-index.js` - Script to create DynamoDB GSI for developer IDs
3. `update-games-api-with-developer.js` - Updated games API to store developer IDs
4. `create-games-developer-index.js` - Script to create GSI on games table

## Deployment Steps

### Step 1: Create DynamoDB Indexes
First, create the required Global Secondary Indexes:

```bash
# Create GSI on users table for developerId lookups
node create-developer-id-index.js

# Create GSI on games table for developer's games queries
node create-games-developer-index.js
```

Wait for both indexes to become ACTIVE before proceeding.

### Step 2: Deploy Enhanced Developers API
Replace the existing Lambda function with the enhanced version:

1. Go to AWS Lambda console
2. Find the `trioll-prod-developers-api` function (or create if doesn't exist)
3. Replace the function code with `developers-api-enhanced.js`
4. Set environment variables:
   - `USERS_TABLE`: trioll-prod-users
   - `USER_POOL_ID`: us-east-1_cLPH2acQd
   - `CLIENT_ID`: 5joogquqr4jgukp7mncgp3g23h
   - `JWT_SECRET`: (your JWT secret)

### Step 3: Update Games API
Update the games Lambda function to support developer IDs:

1. Find the `trioll-prod-games-api` function
2. Add the new code from `update-games-api-with-developer.js`
3. Ensure it has access to both GAMES_TABLE and USERS_TABLE

### Step 4: Add API Gateway Routes
Ensure these routes exist in API Gateway:

1. `/developers/register` (POST)
2. `/developers/login` (POST)
3. `/developers/profile` (GET)
4. `/developers/games` (GET)

### Step 5: Update IAM Permissions
Ensure Lambda functions have permissions to:

1. Read/Write to DynamoDB tables (trioll-prod-users, trioll-prod-games)
2. Query using the new GSIs
3. Access Cognito for user management

## How Developer ID Generation Works

1. **Base ID Generation**:
   - Takes email username (before @)
   - Uses first 6 characters
   - Converts to lowercase
   - Replaces non-alphanumeric with '0'
   - Example: `freddiecaplin@hotmail.com` → `dev_freddi`

2. **Increment for Similar Emails**:
   - Queries existing IDs with same base
   - Finds highest number suffix
   - Assigns next available number
   - Examples:
     - `freddiecaplin@hotmail.com` → `dev_freddi`
     - `freddiecaplin1@hotmail.com` → `dev_freddi1`
     - `freddiecaplin2@hotmail.com` → `dev_freddi2`

3. **Storage**:
   - Developer ID stored in users table
   - Indexed for fast lookups
   - Linked to games when uploaded

## Testing

After deployment, test the system:

1. **Register new developer**:
```bash
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","companyName":"Test Dev"}'
```

2. **Login and get developer ID**:
```bash
curl -X POST https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

3. **Get developer profile**:
```bash
curl -X GET https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/developers/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Frontend Updates Required

After backend deployment, update the frontend:

1. Remove the local ID generation code
2. Use the developer ID returned from login/profile endpoints
3. Include developer ID when uploading games

## Notes

- Existing users will get developer IDs assigned on next login
- The system handles race conditions using DynamoDB queries
- IDs are permanent once assigned (never change)
- Duplicate emails are prevented (one account per email)