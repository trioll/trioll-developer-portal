# Long-Term Solution: Add Developer ID to JWT Tokens

## Overview
The best long-term solution is to have Cognito automatically include `developer_id` in every JWT token. This eliminates the need for database lookups and makes the system more efficient and scalable.

## Solution Components

### 1. Pre-Token Generation Lambda Trigger
Create a Lambda function that runs before Cognito generates tokens. This function will:
- Look up the user's developer_id from DynamoDB
- Add it to the token as a custom claim
- Cache the developer_id in Cognito user attributes for future use

### 2. Benefits
- ✅ No database lookups on every API call
- ✅ Faster API responses
- ✅ Cleaner Lambda code
- ✅ Standard JWT authentication pattern
- ✅ Works across all your platforms (mobile, web, developer portal)

## Implementation Steps

### Step 1: Create Pre-Token Generation Lambda

Create file: `cognito-pre-token-generation.js`

```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE || 'trioll-prod-users';

exports.handler = async (event) => {
    console.log('Pre-token generation trigger:', JSON.stringify(event, null, 2));
    
    // Extract user information
    const { userPoolId, userName, request } = event;
    const { userAttributes } = request;
    const userId = userAttributes.sub;
    const email = userAttributes.email;
    
    // Check if developer_id already exists in attributes
    if (userAttributes['custom:developer_id']) {
        // Already has developer_id, just pass it through
        event.response = {
            claimsOverrideDetails: {
                claimsToAddOrOverride: {
                    'custom:developer_id': userAttributes['custom:developer_id'],
                    'custom:user_type': userAttributes['custom:user_type'] || 'developer'
                }
            }
        };
        return event;
    }
    
    // Look up developer_id from DynamoDB
    try {
        // Query users table
        const params = {
            TableName: USERS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 1
        };
        
        const result = await dynamodb.query(params).promise();
        
        if (result.Items && result.Items.length > 0) {
            const user = result.Items[0];
            
            if (user.developerId) {
                // Add developer_id to token claims
                event.response = {
                    claimsOverrideDetails: {
                        claimsToAddOrOverride: {
                            'custom:developer_id': user.developerId,
                            'custom:user_type': user.userType || 'developer',
                            'custom:company_name': user.companyName || email.split('@')[0]
                        }
                    }
                };
                
                // Also update Cognito user attributes for future use
                const cognito = new AWS.CognitoIdentityServiceProvider();
                try {
                    await cognito.adminUpdateUserAttributes({
                        UserPoolId: userPoolId,
                        Username: userName,
                        UserAttributes: [
                            { Name: 'custom:developer_id', Value: user.developerId },
                            { Name: 'custom:user_type', Value: user.userType || 'developer' },
                            { Name: 'custom:company_name', Value: user.companyName || email.split('@')[0] }
                        ]
                    }).promise();
                    console.log('Updated Cognito attributes for user:', userName);
                } catch (updateError) {
                    console.error('Failed to update Cognito attributes:', updateError);
                    // Continue anyway - token claims are set
                }
            }
        } else {
            // User not found in database
            console.log('User not found in database:', userId);
        }
    } catch (error) {
        console.error('Error looking up developer_id:', error);
        // Don't fail authentication, just continue without custom claims
    }
    
    return event;
};
```

### Step 2: Deploy Pre-Token Lambda

Create deployment script: `deploy-pre-token-lambda.sh`

```bash
#!/bin/bash

FUNCTION_NAME="trioll-prod-pre-token-generation"
ROLE_ARN="arn:aws:iam::561645284740:role/trioll-lambda-role"
REGION="us-east-1"

echo "📦 Creating deployment package..."
zip -r pre-token-lambda.zip cognito-pre-token-generation.js

echo "🚀 Creating Lambda function..."
aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler cognito-pre-token-generation.handler \
    --zip-file fileb://pre-token-lambda.zip \
    --timeout 10 \
    --memory-size 256 \
    --environment Variables="{USERS_TABLE='trioll-prod-users'}" \
    --region $REGION

echo "✅ Lambda function created"
```

### Step 3: Add Custom Attributes to Cognito User Pool

```bash
# Add custom attributes (if not already present)
aws cognito-idp add-custom-attributes \
    --user-pool-id us-east-1_cLPH2acQd \
    --custom-attributes \
        Name=developer_id,AttributeDataType=String,Mutable=true \
        Name=user_type,AttributeDataType=String,Mutable=true \
        Name=company_name,AttributeDataType=String,Mutable=true \
    --region us-east-1
```

### Step 4: Configure Lambda Trigger in Cognito

```bash
# Add pre-token generation trigger
aws cognito-idp update-user-pool \
    --user-pool-id us-east-1_cLPH2acQd \
    --lambda-config PreTokenGeneration=arn:aws:lambda:us-east-1:561645284740:function:trioll-prod-pre-token-generation \
    --region us-east-1

# Grant Cognito permission to invoke Lambda
aws lambda add-permission \
    --function-name trioll-prod-pre-token-generation \
    --statement-id CognitoPreTokenGen \
    --action lambda:InvokeFunction \
    --principal cognito-idp.amazonaws.com \
    --source-arn arn:aws:cognito-idp:us-east-1:561645284740:userpool/us-east-1_cLPH2acQd \
    --region us-east-1
```

### Step 5: Update Registration Flow

Update your registration Lambda to set custom attributes:

```javascript
// In your registration handler, after creating user in DynamoDB:
await cognito.adminUpdateUserAttributes({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
        { Name: 'custom:developer_id', Value: developerId },
        { Name: 'custom:user_type', Value: 'developer' },
        { Name: 'custom:company_name', Value: companyName }
    ]
}).promise();
```

## Migration for Existing Users

Create `migrate-existing-users.js`:

```javascript
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = 'us-east-1_cLPH2acQd';
const USERS_TABLE = 'trioll-prod-users';

async function migrateUsers() {
    console.log('Starting user migration...');
    
    // Scan all users from DynamoDB
    const dbUsers = await dynamodb.scan({
        TableName: USERS_TABLE,
        FilterExpression: 'attribute_exists(developerId)'
    }).promise();
    
    console.log(`Found ${dbUsers.Items.length} users with developer IDs`);
    
    for (const user of dbUsers.Items) {
        try {
            console.log(`Updating Cognito attributes for ${user.email}`);
            
            await cognito.adminUpdateUserAttributes({
                UserPoolId: USER_POOL_ID,
                Username: user.email,
                UserAttributes: [
                    { Name: 'custom:developer_id', Value: user.developerId },
                    { Name: 'custom:user_type', Value: user.userType || 'developer' },
                    { Name: 'custom:company_name', Value: user.companyName || user.email.split('@')[0] }
                ]
            }).promise();
            
            console.log(`✅ Updated ${user.email}`);
        } catch (error) {
            console.error(`❌ Failed to update ${user.email}:`, error.message);
        }
    }
    
    console.log('Migration complete!');
}

migrateUsers();
```

## Testing

After implementation:
1. Log out and log back in
2. Your new token will contain:
   ```json
   {
     "custom:developer_id": "dev_c84a7e",
     "custom:user_type": "developer",
     "custom:company_name": "FreddieTrioll"
   }
   ```
3. The API will work without any database lookups

## Advantages of This Solution

1. **Performance**: No database lookups on every API call
2. **Reliability**: Token contains all needed information
3. **Scalability**: Works for unlimited users without impacting performance
4. **Consistency**: Same developer_id across all services
5. **Security**: Claims are signed by Cognito, preventing tampering

## Rollback Plan

If issues occur:
1. Remove Lambda trigger from Cognito
2. APIs will fall back to database lookups (already implemented)
3. No service disruption

This is the production-ready solution used by major platforms!