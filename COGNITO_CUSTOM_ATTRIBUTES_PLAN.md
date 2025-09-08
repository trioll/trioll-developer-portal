# Cognito Custom Attributes Implementation Plan

## Decision: Option 1 - Add Custom Attributes to Cognito

### Why Option 1 is Better (Despite Complexity)

1. **Clean Architecture**: Auth data belongs in auth tokens
2. **Performance**: No extra database lookups on every request
3. **No Live Users**: Perfect time to make breaking changes
4. **Future-Proof**: Scales better as user base grows
5. **Industry Standard**: JWTs should be self-contained

## Implementation Tasks

### Phase 1: Preparation & Backup

#### Task 1.1: Document Current State
- [ ] Export current Cognito User Pool configuration
- [ ] List all existing users (should be minimal)
- [ ] Document current Lambda function versions
- [ ] Create rollback plan

```bash
# Commands to run:
aws cognito-idp describe-user-pool --user-pool-id us-east-1_cLPH2acQd > cognito-backup.json
aws cognito-idp list-users --user-pool-id us-east-1_cLPH2acQd > users-backup.json
```

### Phase 2: Add Custom Attributes to Cognito

#### Task 2.1: Create Schema Update Script
```javascript
// cognito-add-custom-attributes.js
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-east-1' });

// Note: Custom attributes can only be added, not modified or removed
const customAttributes = [
    {
        Name: 'developer_id',
        AttributeDataType: 'String',
        Mutable: true,
        Required: false,
        StringAttributeConstraints: {
            MinLength: '1',
            MaxLength: '50'
        }
    },
    {
        Name: 'company_name',
        AttributeDataType: 'String',
        Mutable: true,
        Required: false,
        StringAttributeConstraints: {
            MinLength: '1',
            MaxLength: '100'
        }
    },
    {
        Name: 'user_type',
        AttributeDataType: 'String',
        Mutable: true,
        Required: false,
        StringAttributeConstraints: {
            MinLength: '1',
            MaxLength: '20'
        }
    }
];
```

#### Task 2.2: Update App Client Settings
- [ ] Add read/write permissions for custom attributes
- [ ] Update both developer and mobile app clients

### Phase 3: Update Lambda Functions

#### Task 3.1: Update Login Handler (users-api)
```javascript
// During login, fetch from DynamoDB and update Cognito
const updateCognitoAttributes = async (username, attributes) => {
    const params = {
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: [
            { Name: 'custom:developer_id', Value: attributes.developerId },
            { Name: 'custom:company_name', Value: attributes.companyName },
            { Name: 'custom:user_type', Value: 'developer' }
        ]
    };
    
    await cognito.adminUpdateUserAttributes(params).promise();
};
```

#### Task 3.2: Update Signup Handler
```javascript
// During signup, include custom attributes
const signUpParams = {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:developer_id', Value: developerId },
        { Name: 'custom:company_name', Value: companyName },
        { Name: 'custom:user_type', Value: 'developer' }
    ]
};
```

### Phase 4: Migrate Existing Users

#### Task 4.1: Create Migration Script
```javascript
// migrate-existing-users.js
const migrateUser = async (cognitoUser, dynamoUser) => {
    if (!dynamoUser.developerId) return;
    
    await cognito.adminUpdateUserAttributes({
        UserPoolId: USER_POOL_ID,
        Username: cognitoUser.Username,
        UserAttributes: [
            { Name: 'custom:developer_id', Value: dynamoUser.developerId },
            { Name: 'custom:company_name', Value: dynamoUser.companyName || '' },
            { Name: 'custom:user_type', Value: dynamoUser.userType || 'developer' }
        ]
    }).promise();
};
```

### Phase 5: Simplify Lambda Token Handling

#### Task 5.1: Update Token Decoder
```javascript
// Simplified - no more database lookups needed
const getDeveloperFromToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        
        return {
            userId: payload.sub,
            email: payload.email,
            developerId: payload['custom:developer_id'],  // Now it exists!
            companyName: payload['custom:company_name'],
            userType: payload['custom:user_type']
        };
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};
```

### Phase 6: Testing & Validation

#### Task 6.1: Test Scenarios
1. [ ] New user signup - verify custom attributes in token
2. [ ] Existing user login - verify attributes populated
3. [ ] API calls with new tokens - verify authorization works
4. [ ] Token refresh - verify attributes persist
5. [ ] Game upload - verify developer_id captured
6. [ ] Game edit - verify ownership check works

#### Task 6.2: Validation Checklist
- [ ] All existing users migrated successfully
- [ ] New tokens contain custom attributes
- [ ] No more "hasDeveloperId: false" errors
- [ ] All API endpoints working
- [ ] Frontend correctly reads developer info

### Phase 7: Cleanup

#### Task 7.1: Remove Workarounds
- [ ] Remove DynamoDB fallback lookups from Lambdas
- [ ] Remove hardcoded developer IDs
- [ ] Remove temporary auth fixes
- [ ] Clean up redundant code

## Rollback Plan

If issues arise:
1. Revert Lambda functions to previous versions
2. Frontend will continue working with sessionStorage
3. No Cognito changes can be rolled back (attributes are permanent)
4. Can add fallback code back if needed

## Timeline

- **Phase 1-2**: 30 minutes (Cognito setup)
- **Phase 3**: 1 hour (Lambda updates)
- **Phase 4**: 30 minutes (User migration)
- **Phase 5**: 30 minutes (Simplify code)
- **Phase 6**: 1 hour (Testing)
- **Total**: ~3.5 hours

## Success Criteria

1. JWT tokens contain developer_id, company_name, user_type
2. No authentication errors in API calls
3. All existing functionality works
4. Cleaner, more maintainable code

## Note on Cognito Limitations

- Custom attributes CANNOT be removed once added
- Attribute names will have 'custom:' prefix
- Maximum 25 custom attributes per user pool
- Attributes can be made immutable but we want them mutable